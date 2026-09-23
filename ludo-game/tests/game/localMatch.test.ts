import {describe, expect, it} from 'vitest';
import {replayMatch} from '../../src/game/index.ts';
import {
  LocalMatch,
  buildLocalConfig,
  type LocalSetup,
} from '../../src/game/session/localMatch.ts';
import {createSeededRandom} from '../../src/utils/random.ts';

const base: LocalSetup = {
  matchId: 'local-1',
  playMode: 'vs_computer',
  format: '4p',
  humanSeats: 1,
  humanNames: ['Nasser'],
  aiDifficulty: 'hard',
  endGameMode: 'top_two_final_duel',
  adventure: false,
  adventureSeed: null,
};

function playOut(
  match: LocalMatch,
  humanPolicy: (m: LocalMatch) => void,
  max = 20_000
) {
  for (let i = 0; i < max && match.state.phase.kind !== 'finished'; i++) {
    if (match.isAiTurn()) match.aiStep();
    else humanPolicy(match);
  }
}

describe('local match session', () => {
  it('vs computer: one human, AI opponents, finishes and replays identically', () => {
    let t = 0;
    const match = new LocalMatch(
      buildLocalConfig(base, createSeededRandom('cfg')),
      createSeededRandom('dice'),
      createSeededRandom('ai'),
      () => ++t
    );
    expect(match.humanColors()).toEqual(['green']);
    const seen: string[] = [];
    match.subscribe((_, events) => seen.push(...events.map(e => e.type)));
    playOut(match, m => {
      if (m.state.phase.kind === 'awaiting_roll') m.humanRoll();
      else if (m.state.phase.kind === 'awaiting_move')
        m.humanMove(m.state.phase.legalMoves[0]?.pawnIndex ?? 0);
    });
    expect(match.state.phase.kind).toBe('finished');
    expect(seen).toContain('GAME_FINISHED');
    const replay = replayMatch({
      config: match.config,
      startedAt: match.startedAt,
      actions: match.actions,
    });
    if (!replay.ok) throw new Error();
    expect(replay.value.state).toEqual(match.state);
  });

  it('humans cannot act during AI turns and AIs cannot act during human turns', () => {
    const match = new LocalMatch(
      buildLocalConfig(base, createSeededRandom('c')),
      createSeededRandom('d'),
      createSeededRandom('a'),
      () => 0
    );
    expect(match.isHumanTurn()).toBe(true);
    expect(match.aiStep()).toBeNull();
    // Burn the human turn until an AI plays.
    for (let i = 0; i < 50 && !match.isAiTurn(); i++) {
      if (match.state.phase.kind === 'awaiting_roll') match.humanRoll();
      else if (match.state.phase.kind === 'awaiting_move')
        match.humanMove(match.state.phase.legalMoves[0]?.pawnIndex ?? 0);
    }
    expect(match.isAiTurn()).toBe(true);
    expect(match.humanRoll()).toBeNull();
    expect(match.humanMove(0)).toBeNull();
  });

  it('pass-and-play with Adventure seed and 2v2 formats', () => {
    const cfg = buildLocalConfig(
      {
        ...base,
        playMode: 'local',
        format: '2v2',
        humanSeats: 4,
        adventure: true,
        adventureSeed: 'LUDO-847291',
      },
      createSeededRandom('x')
    );
    expect(cfg.mode).toBe('team');
    expect(cfg.adventure?.seed).toBe('LUDO-847291');
    expect(cfg.seats.every(s => s.controller.kind === 'human')).toBe(true);
    const match = new LocalMatch(
      cfg,
      createSeededRandom('d2'),
      createSeededRandom('a2'),
      () => 0
    );
    playOut(match, m => {
      if (m.state.phase.kind === 'awaiting_roll') m.humanRoll();
      else if (m.state.phase.kind === 'awaiting_move')
        m.humanMove(m.state.phase.legalMoves.at(-1)?.pawnIndex ?? 0);
    });
    expect(match.state.phase.kind).toBe('finished');
    const winners = match.state.rankings
      .filter(r => r.rank === 1)
      .map(r => r.color)
      .sort();
    expect([
      ['blue', 'green'],
      ['red', 'yellow'],
    ]).toContainEqual(winners);
  });

  it('an invalid typed seed falls back to a generated valid seed', () => {
    const cfg = buildLocalConfig(
      {...base, adventure: true, adventureSeed: 'hello'},
      createSeededRandom('s')
    );
    expect(cfg.adventure?.seed).toMatch(/^LUDO-\d{6}$/);
  });
});
