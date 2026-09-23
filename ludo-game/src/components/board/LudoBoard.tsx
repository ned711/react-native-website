/**
 * Top-down board renderer. Every cell position comes from the logical
 * geometry (game/board/layout.ts) - the drawing cannot diverge from the rules.
 */
import {memo, useMemo, type ReactNode} from 'react';
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet, View} from 'react-native';
import {definitionFor} from '../../game/adventure/definitions.ts';
import {START_INDEX} from '../../game/board/constants.ts';
import {
  BASE_REGIONS,
  BASE_SLOTS,
  CENTER_REGION,
  FINAL_LANE_CELLS,
  GRID_SIZE,
  TRACK_CELLS,
  pointForPawn,
} from '../../game/board/layout.ts';
import {
  PLAYER_COLORS,
  type AdventureEventKind,
  type GameState,
  type PlayerColor,
} from '../../game/types.ts';
import {sceneryFor} from '../../themes/scenery.ts';
import type {ThemeDefinition} from '../../themes/types.ts';
import {AppText} from '../ui/AppText.tsx';
import {Pawn, type PawnAnimation} from './Pawn.tsx';

const ADVENTURE_GLYPH: Readonly<Record<AdventureEventKind, string>> = {
  prison: '⛓',
  freeze: '❄',
  backward: '↩',
  boost: '⇥',
  teleport: '✦',
  treasure: '◆',
  shield: '⛨',
  bonus_turn: '↻',
};

export interface LudoBoardProps {
  readonly state: GameState;
  readonly theme: ThemeDefinition;
  readonly size: number;
  readonly movable: ReadonlySet<string>;
  readonly onPawnPress: (color: PlayerColor, pawnIndex: number) => void;
  readonly animations: ReadonlyMap<string, PawnAnimation>;
  readonly characterGlyph: (color: PlayerColor) => string;
  readonly reduceMotion: boolean;
  /** Names drawn inside each colour's quadrant. */
  readonly playerLabels?: Readonly<Partial<Record<PlayerColor, string>>>;
}

export const pawnKey = (color: PlayerColor, index: number) =>
  `${color}:${index}`;

const ARROW_ROTATION: Readonly<Record<PlayerColor, string>> = {
  green: '0deg',
  yellow: '90deg',
  blue: '180deg',
  red: '270deg',
};

function Bevel({
  left,
  top,
  size,
  color,
  light,
  dark,
  children,
}: {
  readonly left: number;
  readonly top: number;
  readonly size: number;
  readonly color: string;
  readonly light: string;
  readonly dark: string;
  readonly children?: ReactNode;
}) {
  const b = Math.max(1, size * 0.06);
  return (
    <View
      style={[
        styles.abs,
        styles.center,
        {
          left,
          top,
          width: size,
          height: size,
          backgroundColor: color,
          borderTopWidth: b,
          borderLeftWidth: b,
          borderBottomWidth: b,
          borderRightWidth: b,
          borderTopColor: light,
          borderLeftColor: light,
          borderBottomColor: dark,
          borderRightColor: dark,
        },
      ]}>
      {children}
    </View>
  );
}

const StaticBoard = memo(function StaticBoard({
  theme,
  cell,
  safe,
  adventure,
  labels,
}: {
  readonly theme: ThemeDefinition;
  readonly cell: number;
  readonly safe: readonly number[];
  readonly adventure: GameState['config']['adventure'];
  readonly labels: Readonly<Partial<Record<PlayerColor, string>>>;
}) {
  const p = theme.palette;
  const scene = sceneryFor(theme);
  const startColor = new Map<number, PlayerColor>(
    PLAYER_COLORS.map(c => [START_INDEX[c], c])
  );
  const entryColor = new Map<number, PlayerColor>(
    PLAYER_COLORS.map(c => [(START_INDEX[c] + 51) % 52, c])
  );
  const centerSize = CENTER_REGION.size * cell;
  const half = centerSize / 2;
  return (
    <>
      {PLAYER_COLORS.map(color => {
        const r = BASE_REGIONS[color];
        const colors = p.players[color];
        const side = r.size * cell;
        const disc = side * 0.78;
        const labelOnTop = r.row === 0;
        return (
          <LinearGradient
            key={`base-${color}`}
            colors={[colors.light, colors.main, colors.dark]}
            locations={[0, 0.45, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={[
              styles.abs,
              {
                left: r.col * cell,
                top: r.row * cell,
                width: side,
                height: side,
              },
            ]}>
            <View
              style={[
                styles.abs,
                styles.disc,
                {
                  left: (side - disc) / 2,
                  top: (side - disc) / 2,
                  width: disc,
                  height: disc,
                  borderRadius: disc / 2,
                  backgroundColor: scene.marble.base,
                  borderColor: scene.marble.ring,
                  borderWidth: Math.max(2, cell * 0.12),
                },
              ]}>
              <LinearGradient
                colors={[scene.marble.light, scene.marble.base]}
                start={{x: 0.2, y: 0}}
                end={{x: 0.8, y: 1}}
                style={[StyleSheet.absoluteFill, {borderRadius: disc / 2}]}
              />
            </View>
            {labels[color] ? (
              <AppText
                numberOfLines={1}
                style={[
                  styles.abs,
                  styles.quadLabel,
                  {
                    left: cell * 0.3,
                    right: cell * 0.3,
                    fontSize: cell * 0.55,
                    top: labelOnTop ? cell * 0.05 : undefined,
                    bottom: labelOnTop ? undefined : cell * 0.05,
                  },
                ]}>
                {labels[color]}
              </AppText>
            ) : null}
          </LinearGradient>
        );
      })}
      {PLAYER_COLORS.flatMap(color =>
        BASE_SLOTS[color].map((slot, i) => (
          <View
            key={`slot-${color}-${i}`}
            style={[
              styles.abs,
              {
                left: (slot.x - 0.4) * cell,
                top: (slot.y - 0.2) * cell,
                width: cell * 0.8,
                height: cell * 0.4,
                borderRadius: cell,
                backgroundColor: 'rgba(0,0,0,0.12)',
              },
            ]}
          />
        ))
      )}
      {TRACK_CELLS.map((c, global) => {
        const owner = startColor.get(global);
        const entry = entryColor.get(global);
        const isSafe = safe.includes(global);
        const event = adventure?.cells.find(e => e.trackPosition === global);
        const polarity = event ? definitionFor(event.kind).polarity : null;
        const star = owner || isSafe;
        return (
          <Bevel
            key={`track-${global}`}
            left={c.col * cell}
            top={c.row * cell}
            size={cell}
            color={isSafe && !owner ? scene.safeCell : scene.stone.base}
            light={scene.stone.light}
            dark={scene.stone.dark}>
            {star ? (
              <AppText
                style={{
                  fontSize: cell * 0.62,
                  lineHeight: cell * 0.8,
                  color: owner ? p.players[owner].main : '#FFFFFF',
                }}>
                ★
              </AppText>
            ) : entry ? (
              <AppText
                style={{
                  fontSize: cell * 0.6,
                  lineHeight: cell * 0.8,
                  fontWeight: '900',
                  color: p.players[entry].main,
                  transform: [{rotate: ARROW_ROTATION[entry]}],
                }}>
                ❯
              </AppText>
            ) : event ? (
              <AppText
                style={{
                  fontSize: cell * 0.55,
                  lineHeight: cell * 0.8,
                  color: polarity === 'positive' ? '#2E7D32' : '#C62828',
                }}>
                {ADVENTURE_GLYPH[event.kind]}
              </AppText>
            ) : null}
          </Bevel>
        );
      })}
      {PLAYER_COLORS.flatMap(color =>
        FINAL_LANE_CELLS[color].map((c, i) => (
          <Bevel
            key={`lane-${color}-${i}`}
            left={c.col * cell}
            top={c.row * cell}
            size={cell}
            color={p.players[color].main}
            light={p.players[color].light}
            dark={p.players[color].dark}
          />
        ))
      )}
      {/* Centre: four triangles, each on the side its lane comes from. */}
      <View
        style={[
          styles.abs,
          {
            left: CENTER_REGION.col * cell,
            top: CENTER_REGION.row * cell,
            width: centerSize,
            height: centerSize,
          },
        ]}>
        <View
          style={[
            styles.abs,
            styles.tri,
            {
              borderTopWidth: half,
              borderLeftWidth: half,
              borderRightWidth: half,
              borderTopColor: p.players.yellow.main,
              top: 0,
              left: 0,
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            styles.tri,
            {
              borderRightWidth: half,
              borderTopWidth: half,
              borderBottomWidth: half,
              borderRightColor: p.players.blue.main,
              top: 0,
              right: 0,
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            styles.tri,
            {
              borderBottomWidth: half,
              borderLeftWidth: half,
              borderRightWidth: half,
              borderBottomColor: p.players.red.main,
              bottom: 0,
              left: 0,
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            styles.tri,
            {
              borderLeftWidth: half,
              borderTopWidth: half,
              borderBottomWidth: half,
              borderLeftColor: p.players.green.main,
              top: 0,
              left: 0,
            },
          ]}
        />
      </View>
    </>
  );
});

export function LudoBoard({
  state,
  theme,
  size,
  movable,
  onPawnPress,
  animations,
  characterGlyph,
  reduceMotion,
  playerLabels = {},
}: LudoBoardProps) {
  const scene = sceneryFor(theme);
  const frame = Math.max(4, size * 0.02);
  const inner = size - frame * 2;
  const cell = inner / GRID_SIZE;

  // Group pawns by drawn point to offset stacked pawns slightly.
  const pawns = useMemo(() => {
    const byPoint = new Map<string, number>();
    const list: {
      color: PlayerColor;
      index: number;
      x: number;
      y: number;
      stackIndex: number;
      position: number;
    }[] = [];
    for (const player of state.players) {
      if (player.status === 'left') continue;
      state.pawns[player.color].forEach((position, index) => {
        const point = pointForPawn(player.color, position, index);
        const k = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        const stackIndex = byPoint.get(k) ?? 0;
        byPoint.set(k, stackIndex + 1);
        list.push({
          color: player.color,
          index,
          x: point.x,
          y: point.y,
          stackIndex,
          position,
        });
      });
    }
    return list;
  }, [state.players, state.pawns]);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          padding: frame,
          backgroundColor: scene.frame.wood,
          borderColor: scene.frame.trim,
          borderRadius: frame * 2,
        },
      ]}
      accessibilityLabel="Plateau de Ludo">
      <View
        style={[
          styles.boardInner,
          {width: inner, height: inner, borderRadius: frame},
        ]}>
        <StaticBoard
          theme={theme}
          cell={cell}
          safe={state.config.rules.safeTrackPositions}
          adventure={state.config.adventure}
          labels={playerLabels}
        />
      </View>
      <View
        style={[
          styles.abs,
          {left: frame, top: frame, width: inner, height: inner},
        ]}
        pointerEvents="box-none">
        {pawns.map(p => {
          const key = pawnKey(p.color, p.index);
          const offset = p.stackIndex * cell * 0.18;
          return (
            <Pawn
              key={key}
              color={theme.palette.players[p.color]}
              glyph={characterGlyph(p.color)}
              cell={cell}
              sizeScale={p.position === -1 ? 1.3 : 1}
              x={p.x + offset / cell}
              y={p.y - offset / cell}
              animation={animations.get(key) ?? null}
              movable={movable.has(key)}
              shielded={state.shields[p.color][p.index] ?? false}
              reduceMotion={reduceMotion}
              accessibilityLabel={`Pion ${p.color} ${p.index + 1}, position ${p.position}`}
              onPress={() => onPawnPress(p.color, p.index)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 10,
  },
  boardInner: {overflow: 'hidden'},
  abs: {position: 'absolute'},
  center: {alignItems: 'center', justifyContent: 'center'},
  disc: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
    elevation: 4,
  },
  quadLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: {width: 0, height: 1},
  },
  tri: {width: 0, height: 0, borderColor: 'transparent'},
});
