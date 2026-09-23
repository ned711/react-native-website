import * as ExpoCrypto from 'expo-crypto';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {AudioEngine, noAudioOutputBackend} from '../audio/engine.ts';
import {getAudioPack} from '../audio/packs.ts';
import {
  RETURN_MS,
  STEP_MS,
  type PawnAnimation,
} from '../components/board/Pawn.tsx';
import {pawnKey} from '../components/board/LudoBoard.tsx';
import {pointForPawn} from '../game/board/layout.ts';
import type {GameEvent} from '../game/events/types.ts';
import {LocalMatch, buildLocalConfig} from '../game/session/localMatch.ts';
import type {DieValue, GameState, PlayerColor} from '../game/types.ts';
import {statsFromEvents} from '../progression/stats.ts';
import {deviceRandom} from '../services/deviceRandom.ts';
import {expoHapticsBackend} from '../services/haptics.ts';
import {useLocalStats} from '../state/localStats.tsx';
import type {MatchSetup} from '../state/matchSetup.ts';
import {useSettings} from '../state/settings.tsx';
import {getTheme} from '../themes/themes.ts';
import {createSeededRandom} from '../utils/random.ts';
import {describeEvent} from './describeEvent.ts';

const AI_DELAY_MS = 550;

export interface DiceView {
  readonly value: DieValue | null;
  readonly rollId: number;
  readonly rolling: boolean;
}

export interface LocalMatchView {
  readonly state: GameState;
  readonly dice: DiceView;
  readonly animations: ReadonlyMap<string, PawnAnimation>;
  readonly movable: ReadonlySet<string>;
  readonly canRoll: boolean;
  readonly humanColors: readonly PlayerColor[];
  readonly log: readonly string[];
  /** Local human who just finished and must choose: stay (spectate) or leave. */
  readonly finishedPrompt: PlayerColor | null;
  roll(): void;
  movePawn(color: PlayerColor, pawnIndex: number): void;
  onDiceAnimationEnd(): void;
  dismissFinishedPrompt(): void;
}

export function useLocalMatch(setup: MatchSetup): LocalMatchView {
  const {settings} = useSettings();
  const {record} = useLocalStats();
  const matchRef = useRef<LocalMatch | null>(null);
  if (!matchRef.current) {
    const config = buildLocalConfig(
      {
        matchId: ExpoCrypto.randomUUID(),
        playMode: setup.playMode,
        format: setup.format,
        humanSeats: setup.humanSeats,
        humanNames: Array.from({length: 4}, (_, i) =>
          setup.playMode === 'vs_computer' ? 'Vous' : `Joueur ${i + 1}`
        ),
        aiDifficulty: setup.aiDifficulty,
        endGameMode: setup.endGameMode,
        adventure: setup.adventure,
        adventureSeed: setup.adventureSeed,
      },
      deviceRandom
    );
    // AI randomness is independent from the dice source.
    matchRef.current = new LocalMatch(
      config,
      deviceRandom,
      createSeededRandom(ExpoCrypto.randomUUID()),
      () => Date.now()
    );
  }
  const match = matchRef.current;

  const [state, setState] = useState<GameState>(match.state);
  const [dice, setDice] = useState<DiceView>({
    value: null,
    rollId: 0,
    rolling: false,
  });
  const [animations, setAnimations] = useState<
    ReadonlyMap<string, PawnAnimation>
  >(new Map());
  const [animatingUntil, setAnimatingUntil] = useState(0);
  const [log, setLog] = useState<readonly string[]>([]);
  const [finishedPrompt, setFinishedPrompt] = useState<PlayerColor | null>(
    null
  );
  const [active, setActive] = useState(AppState.currentState === 'active');
  const allEvents = useRef<GameEvent[]>([]);
  const animationId = useRef(0);

  const audio = useMemo(
    () =>
      new AudioEngine(
        getAudioPack(getTheme(settings.themeId).audioPackId),
        noAudioOutputBackend,
        expoHapticsBackend
      ),
    [settings.themeId]
  );
  useEffect(() => {
    audio.setSettings(settings.audio);
  }, [audio, settings.audio]);

  const humanColors = useMemo(() => match.humanColors(), [match]);
  const singleHuman =
    humanColors.length === 1 ? (humanColors[0] ?? null) : null;

  useEffect(() => {
    return match.subscribe((next, events) => {
      allEvents.current.push(...events);
      audio.handleEvents(events, singleHuman);
      let busy = 0;
      const anims = new Map<string, PawnAnimation>();
      for (const event of events) {
        switch (event.type) {
          case 'DICE_ROLLED':
            setDice(d => ({
              value: event.payload.value,
              rollId: d.rollId + 1,
              rolling: true,
            }));
            break;
          case 'PAWN_SPAWNED':
          case 'PAWN_MOVED': {
            if (!event.playerColor) break;
            const color = event.playerColor;
            const index = event.payload.pawnIndex;
            const path = event.type === 'PAWN_MOVED' ? event.payload.path : [0];
            anims.set(pawnKey(color, index), {
              id: ++animationId.current,
              kind: 'step',
              points: path.map(pos => pointForPawn(color, pos, index)),
            });
            busy = Math.max(busy, path.length * STEP_MS);
            break;
          }
          case 'ADVENTURE_EVENT_TRIGGERED': {
            if (!event.playerColor || event.payload.from === event.payload.to)
              break;
            const color = event.playerColor;
            const index = event.payload.pawnIndex;
            const key = pawnKey(color, index);
            const previous = anims.get(key);
            const extra = [pointForPawn(color, event.payload.to, index)];
            anims.set(key, {
              id: ++animationId.current,
              kind: 'step',
              points: [...(previous?.points ?? []), ...extra],
            });
            busy += STEP_MS * 2;
            break;
          }
          case 'PAWN_RETURNED':
            if (!event.playerColor) break;
            anims.set(pawnKey(event.playerColor, event.payload.pawnIndex), {
              id: ++animationId.current,
              kind: 'return',
              points: [],
            });
            busy = Math.max(busy, RETURN_MS + STEP_MS * 6);
            break;
          case 'PLAYER_FINISHED':
            if (
              event.playerColor &&
              humanColors.includes(event.playerColor) &&
              next.phase.kind !== 'finished'
            ) {
              setFinishedPrompt(event.playerColor);
            }
            break;
          case 'GAME_FINISHED':
            if (singleHuman) {
              const s = statsFromEvents(allEvents.current, singleHuman);
              record({
                gamesPlayed: 1,
                wins: s.wins,
                captures: s.captures,
                pawnsFinished: s.pawnsFinished,
              });
            } else {
              record({gamesPlayed: 1, wins: 0, captures: 0, pawnsFinished: 0});
            }
            break;
          default:
            break;
        }
      }
      if (anims.size > 0) setAnimations(prev => new Map([...prev, ...anims]));
      if (busy > 0 && !settings.reduceMotion)
        setAnimatingUntil(Date.now() + busy);
      const lines = events
        .map(e => describeEvent(e, next))
        .filter((l): l is string => !!l);
      if (lines.length > 0)
        setLog(prev => [...lines.reverse(), ...prev].slice(0, 6));
      setState(next);
    });
  }, [match, audio, humanColors, singleHuman, record, settings.reduceMotion]);

  // Pause AI turns while the app is in background (battery, fairness).
  useEffect(() => {
    const sub = AppState.addEventListener('change', s =>
      setActive(s === 'active')
    );
    return () => sub.remove();
  }, []);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (animatingUntil <= now) return undefined;
    const t = setTimeout(
      () => setNow(Date.now()),
      animatingUntil - Date.now() + 10
    );
    return () => clearTimeout(t);
  }, [animatingUntil, now]);
  const animating = animatingUntil > now;

  // AI scheduling: only when no dice / pawn animation is running.
  useEffect(() => {
    if (!active || dice.rolling || animating || finishedPrompt)
      return undefined;
    if (!match.isAiTurn()) return undefined;
    const timer = setTimeout(() => {
      match.aiStep();
      setNow(Date.now());
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, dice.rolling, animating, active, finishedPrompt, match]);

  const busy = dice.rolling || animating;
  const humanTurn = match.isHumanTurn();
  const canRoll = humanTurn && state.phase.kind === 'awaiting_roll' && !busy;
  const movable = useMemo(() => {
    const set = new Set<string>();
    if (humanTurn && !busy && state.phase.kind === 'awaiting_move') {
      for (const m of state.phase.legalMoves)
        set.add(pawnKey(m.color, m.pawnIndex));
    }
    return set;
  }, [humanTurn, busy, state.phase]);

  const roll = useCallback(() => {
    if (canRoll) match.humanRoll();
  }, [canRoll, match]);

  const movePawn = useCallback(
    (color: PlayerColor, pawnIndex: number) => {
      if (movable.has(pawnKey(color, pawnIndex))) match.humanMove(pawnIndex);
    },
    [movable, match]
  );

  const onDiceAnimationEnd = useCallback(
    () => setDice(d => ({...d, rolling: false})),
    []
  );
  const dismissFinishedPrompt = useCallback(() => setFinishedPrompt(null), []);

  return {
    state,
    dice,
    animations,
    movable,
    canRoll,
    humanColors,
    log,
    finishedPrompt,
    roll,
    movePawn,
    onDiceAnimationEnd,
    dismissFinishedPrompt,
  };
}
