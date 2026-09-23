import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {pawnKey} from '../components/board/LudoBoard.tsx';
import type {PawnAnimation} from '../components/board/Pawn.tsx';
import type {GameViewModel} from '../components/game/GameView.tsx';
import type {PlayerColor} from '../game/types.ts';
import {
  OnlineMatchController,
  type OnlineSnapshot,
} from '../multiplayer/realtime/onlineMatch.ts';
import {createSupabaseTransport} from '../multiplayer/realtime/supabaseTransport.ts';
import {getSupabase} from '../services/backend.ts';
import {deviceRandom} from '../services/deviceRandom.ts';
import {describeEvent} from './describeEvent.ts';
import {presentEvents} from './eventPresentation.ts';

const realScheduler = {
  now: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface OnlineMatchView {
  readonly snapshot: OnlineSnapshot;
  readonly game: Omit<GameViewModel, 'onQuit'> | null;
  retry(): void;
  leave(): Promise<void>;
}

/** STATUS: PRÉPARÉ - relies on the Supabase transport (not run against a live project). */
export function useOnlineMatch(
  matchId: string,
  userId: string
): OnlineMatchView {
  const controller = useMemo(() => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase non configuré');
    return new OnlineMatchController(
      matchId,
      userId,
      createSupabaseTransport(client),
      realScheduler,
      deviceRandom
    );
  }, [matchId, userId]);
  const [snapshot, setSnapshot] = useState<OnlineSnapshot>(
    controller.snapshot()
  );
  const [dice, setDice] = useState<{
    value: 1 | 2 | 3 | 4 | 5 | 6 | null;
    rollId: number;
    rolling: boolean;
  }>({value: null, rollId: 0, rolling: false});
  const [animations, setAnimations] = useState<
    ReadonlyMap<string, PawnAnimation>
  >(new Map());
  const [busyUntil, setBusyUntil] = useState(0);
  const [log, setLog] = useState<readonly string[]>([]);
  const [finishedPrompt, setFinishedPrompt] = useState<PlayerColor | null>(
    null
  );
  const [, setTick] = useState(0);
  const animationId = useRef(0);

  useEffect(() => {
    const off = controller.subscribe((snap, events) => {
      setSnapshot(snap);
      if (events.length === 0 || !snap.state) return;
      const presented = presentEvents(events, () => ++animationId.current);
      if (presented.animations.size > 0)
        setAnimations(prev => new Map([...prev, ...presented.animations]));
      if (presented.busyMs > 0) setBusyUntil(Date.now() + presented.busyMs);
      if (presented.rolled !== null) {
        const value = presented.rolled;
        setDice(d => ({value, rollId: d.rollId + 1, rolling: true}));
      }
      const state = snap.state;
      const me = controller.myColor();
      for (const e of events) {
        if (
          e.type === 'PLAYER_FINISHED' &&
          e.playerColor === me &&
          state.phase.kind !== 'finished'
        )
          setFinishedPrompt(me);
      }
      const lines = events
        .map(e => describeEvent(e, state))
        .filter((l): l is string => !!l);
      if (lines.length)
        setLog(prev => [...lines.reverse(), ...prev].slice(0, 6));
    });
    controller.start();
    // Returning to the foreground: resynchronise with the server.
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') void controller.resync();
    });
    return () => {
      off();
      sub.remove();
      controller.stop();
    };
  }, [controller]);

  useEffect(() => {
    const remaining = busyUntil - Date.now();
    if (remaining <= 0) return undefined;
    const t = setTimeout(() => setTick(x => x + 1), remaining + 10);
    return () => clearTimeout(t);
  }, [busyUntil]);

  const state = snapshot.state;
  const busy = dice.rolling || busyUntil > Date.now();
  const me = controller.myColor();
  const canAct = !!state && controller.canAct() && !busy;
  const movable = useMemo(() => {
    const set = new Set<string>();
    if (canAct && state?.phase.kind === 'awaiting_move')
      for (const m of state.phase.legalMoves)
        set.add(pawnKey(m.color, m.pawnIndex));
    return set;
  }, [canAct, state]);

  const roll = useCallback(() => void controller.roll(), [controller]);
  const movePawn = useCallback(
    (_c: PlayerColor, i: number) => void controller.move(i),
    [controller]
  );

  return {
    snapshot,
    retry: () => controller.retry(),
    leave: async () => {
      await controller.leave();
    },
    game: state
      ? {
          state,
          dice,
          animations,
          movable,
          canRoll: canAct && state.phase.kind === 'awaiting_roll',
          localColors: me ? [me] : [],
          log,
          finishedPrompt,
          roll,
          movePawn,
          onDiceAnimationEnd: () => setDice(d => ({...d, rolling: false})),
          dismissFinishedPrompt: () => setFinishedPrompt(null),
        }
      : null,
  };
}
