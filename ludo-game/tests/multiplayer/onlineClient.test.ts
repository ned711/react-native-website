import {describe, expect, it} from 'vitest';
import {
  buildGameConfig,
  createGame,
  type GameEvent,
  type GameState,
} from '../../src/game/index.ts';
import {MatchAuthority} from '../../src/multiplayer/authority/authority.ts';
import type {ClientIntent} from '../../src/multiplayer/authority/intents.ts';
import {MemoryLogger} from '../../src/multiplayer/authority/logger.ts';
import {InMemoryMatchStore} from '../../src/multiplayer/authority/store.ts';
import {
  OnlineMatchController,
  type Scheduler,
} from '../../src/multiplayer/realtime/onlineMatch.ts';
import type {
  MatchSubscription,
  MatchTransport,
} from '../../src/multiplayer/realtime/transport.ts';
import {createSeededRandom} from '../../src/utils/random.ts';
import {err, ok} from '../../src/utils/result.ts';

/** TEST-ONLY stand-in for the Edge Function + Supabase Realtime. */
class Hub {
  readonly store = new InMemoryMatchStore();
  readonly authority: MatchAuthority;
  private readonly subs = new Map<string, Set<MatchSubscription>>();
  networkDown = new Set<string>();
  intents = 0;

  constructor() {
    this.authority = new MatchAuthority({
      store: this.store,
      dice: createSeededRandom('hub'),
      clock: () => 0,
      logger: new MemoryLogger(),
    });
  }

  async state(): Promise<GameState> {
    const m = await this.store.load('m1');
    if (!m) throw new Error('no match');
    return m.state;
  }

  transportFor(userId: string): MatchTransport {
    return {
      sendIntent: async (intent: ClientIntent) => {
        if (this.networkDown.has(userId))
          return err({code: 'NETWORK', message: 'offline'});
        this.intents++;
        const r = await this.authority.handleIntent({userId}, intent);
        if (!r.ok) return err({code: r.error.code, message: r.error.message});
        this.broadcast(r.value.state, r.value.events, userId);
        return ok(r.value);
      },
      fetchSnapshot: async () =>
        this.networkDown.has(userId)
          ? err({code: 'NETWORK', message: 'offline'})
          : ok(await this.state()),
      subscribe: (_matchId, handlers) => {
        const set = this.subs.get(userId) ?? new Set();
        set.add(handlers);
        this.subs.set(userId, set);
        queueMicrotask(() =>
          handlers.onStatus(
            this.networkDown.has(userId) ? 'ERROR' : 'SUBSCRIBED'
          )
        );
        return () => set.delete(handlers);
      },
    };
  }

  private broadcast(
    state: GameState,
    events: readonly GameEvent[],
    except: string
  ) {
    for (const [user, set] of this.subs) {
      if (user === except || this.networkDown.has(user)) continue;
      for (const h of set) {
        h.onState(state);
        h.onEvents(events);
      }
    }
  }

  dropChannel(userId: string) {
    this.networkDown.add(userId);
    for (const h of this.subs.get(userId) ?? []) h.onStatus('CLOSED');
  }
}

class ManualScheduler implements Scheduler {
  private t = 0;
  private timers: {at: number; fn: () => void; id: number}[] = [];
  private seq = 0;
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.push({at: this.t + ms, fn, id});
    return id;
  }
  clearTimeout(handle: unknown) {
    this.timers = this.timers.filter(t => t.id !== handle);
  }
  advance(ms: number) {
    this.t += ms;
    const due = this.timers.filter(t => t.at <= this.t);
    this.timers = this.timers.filter(t => t.at > this.t);
    due.forEach(t => t.fn());
  }
}

const flush = () => new Promise(r => setTimeout(r, 0));

async function setup() {
  const hub = new Hub();
  const config = buildGameConfig({
    matchId: 'm1',
    mode: 'online',
    format: '2p',
    endGameMode: 'all_players',
    seats: [
      {playerId: 'alice', displayName: 'Alice', controller: {kind: 'human'}},
      {playerId: 'bob', displayName: 'Bob', controller: {kind: 'human'}},
    ],
  });
  const created = createGame(config, {now: 0});
  if (!created.ok) throw new Error();
  hub.store.put({
    matchId: 'm1',
    state: created.value.state,
    startedAt: 0,
    turnStartedAt: 0,
    missedTurns: {},
  });
  const scheduler = new ManualScheduler();
  const make = (user: string) =>
    new OnlineMatchController(
      'm1',
      user,
      hub.transportFor(user),
      scheduler,
      createSeededRandom(user)
    );
  const alice = make('alice');
  const bob = make('bob');
  alice.start();
  bob.start();
  await flush();
  await flush();
  return {hub, scheduler, alice, bob};
}

describe('online match client against the real authority', () => {
  it('two clients play a full match; both converge on the server state', async () => {
    const {hub, alice, bob} = await setup();
    expect(alice.snapshot().connection.kind).toBe('connected');
    for (let i = 0; i < 5000; i++) {
      const s = alice.snapshot().state;
      if (!s || s.phase.kind === 'finished') break;
      const c = s.currentColor === alice.myColor() ? alice : bob;
      const cs = c.snapshot().state;
      if (!cs) throw new Error();
      if (cs.phase.kind === 'awaiting_roll') expect(await c.roll()).toBe(true);
      else if (cs.phase.kind === 'awaiting_move')
        expect(await c.move(cs.phase.legalMoves[0]?.pawnIndex ?? 0)).toBe(true);
    }
    const server = await hub.state();
    expect(server.phase.kind).toBe('finished');
    expect(alice.snapshot().state).toEqual(server);
    expect(bob.snapshot().state).toEqual(server);
  });

  it('refuses to act out of turn locally and sends only one intent per tap burst', async () => {
    const {hub, alice, bob} = await setup();
    expect(bob.canAct()).toBe(false);
    expect(await bob.roll()).toBe(false);
    const before = hub.intents;
    const results = await Promise.all([
      alice.roll(),
      alice.roll(),
      alice.roll(),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(hub.intents - before).toBe(1);
  });

  it('recovers from a stale state by resynchronising', async () => {
    const {hub, alice, bob} = await setup();
    // Bob misses the broadcast of Alice's roll: his local version is stale.
    hub.networkDown.add('bob');
    await alice.roll();
    hub.networkDown.delete('bob');
    expect(bob.snapshot().state?.version).toBeLessThan(
      (await hub.state()).version
    );
    await bob.resync();
    expect(bob.snapshot().state).toEqual(await hub.state());
  });

  it('reconnects with backoff after losing the channel, then resyncs', async () => {
    const {hub, scheduler, alice, bob} = await setup();
    hub.dropChannel('bob');
    expect(bob.snapshot().connection.kind).toBe('reconnecting');
    await alice.roll(); // the match continues on the server
    scheduler.advance(20_000); // retry while still offline -> another failure
    await flush();
    expect(bob.snapshot().connection.kind).toBe('reconnecting');
    hub.networkDown.delete('bob');
    scheduler.advance(60_000);
    await flush();
    await flush();
    expect(bob.snapshot().connection.kind).toBe('connected');
    expect(bob.snapshot().state).toEqual(await hub.state());
  });

  it('ignores snapshots older than the local one', async () => {
    const {alice} = await setup();
    await alice.roll();
    const current = alice.snapshot().state;
    if (!current) throw new Error();
    // A delayed realtime message with an old version must not roll the state back.
    const old = {...current, version: current.version - 1};
    (alice as unknown as {adopt(s: GameState, e: GameEvent[]): void}).adopt(
      old,
      []
    );
    expect(alice.snapshot().state?.version).toBe(current.version);
  });
});
