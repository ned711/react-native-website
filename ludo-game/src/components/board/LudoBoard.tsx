/**
 * Top-down board renderer. Every cell position comes from the logical
 * geometry (game/board/layout.ts) - the drawing cannot diverge from the rules.
 */
import {memo, useMemo} from 'react';
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
}

export const pawnKey = (color: PlayerColor, index: number) =>
  `${color}:${index}`;

const StaticBoard = memo(function StaticBoard({
  theme,
  cell,
  safe,
  adventure,
}: {
  readonly theme: ThemeDefinition;
  readonly cell: number;
  readonly safe: readonly number[];
  readonly adventure: GameState['config']['adventure'];
}) {
  const p = theme.palette;
  const startColor = new Map<number, PlayerColor>(
    PLAYER_COLORS.map(c => [START_INDEX[c], c])
  );
  const centerSize = CENTER_REGION.size * cell;
  const half = centerSize / 2;
  return (
    <>
      {PLAYER_COLORS.map(color => {
        const r = BASE_REGIONS[color];
        const colors = p.players[color];
        return (
          <View
            key={`base-${color}`}
            style={[
              styles.abs,
              {
                left: r.col * cell,
                top: r.row * cell,
                width: r.size * cell,
                height: r.size * cell,
                backgroundColor: colors.main,
              },
            ]}>
            <View
              style={[
                styles.baseInner,
                {
                  margin: cell * 0.6,
                  borderRadius: (r.size * cell) / 2,
                  backgroundColor: p.boardCell,
                  borderColor: colors.dark,
                },
              ]}
            />
          </View>
        );
      })}
      {PLAYER_COLORS.flatMap(color =>
        BASE_SLOTS[color].map((slot, i) => (
          <View
            key={`slot-${color}-${i}`}
            style={[
              styles.abs,
              styles.slot,
              {
                left: (slot.x - 0.42) * cell,
                top: (slot.y - 0.42) * cell,
                width: cell * 0.84,
                height: cell * 0.84,
                borderRadius: cell,
                backgroundColor: p.players[color].light,
              },
            ]}
          />
        ))
      )}
      {TRACK_CELLS.map((c, global) => {
        const owner = startColor.get(global);
        const event = adventure?.cells.find(e => e.trackPosition === global);
        const polarity = event ? definitionFor(event.kind).polarity : null;
        return (
          <View
            key={`track-${global}`}
            accessible={false}
            style={[
              styles.abs,
              styles.cell,
              {
                left: c.col * cell,
                top: c.row * cell,
                width: cell,
                height: cell,
                backgroundColor: owner ? p.players[owner].main : p.boardCell,
                borderColor: p.boardLine,
              },
            ]}>
            {safe.includes(global) && !owner ? (
              <AppText
                style={{
                  fontSize: cell * 0.6,
                  color: p.safeMark,
                  lineHeight: cell * 0.9,
                }}>
                ★
              </AppText>
            ) : null}
            {event ? (
              <AppText
                style={{
                  fontSize: cell * 0.55,
                  lineHeight: cell * 0.9,
                  color: polarity === 'positive' ? '#2E7D32' : '#C62828',
                }}>
                {ADVENTURE_GLYPH[event.kind]}
              </AppText>
            ) : null}
          </View>
        );
      })}
      {PLAYER_COLORS.flatMap(color =>
        FINAL_LANE_CELLS[color].map((c, i) => (
          <View
            key={`lane-${color}-${i}`}
            style={[
              styles.abs,
              styles.cell,
              {
                left: c.col * cell,
                top: c.row * cell,
                width: cell,
                height: cell,
                backgroundColor: p.players[color].main,
                borderColor: p.boardLine,
              },
            ]}
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
}: LudoBoardProps) {
  const cell = size / GRID_SIZE;

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
        styles.board,
        {width: size, height: size, backgroundColor: theme.palette.boardFrame},
      ]}
      accessibilityLabel="Plateau de Ludo">
      <StaticBoard
        theme={theme}
        cell={cell}
        safe={state.config.rules.safeTrackPositions}
        adventure={state.config.adventure}
      />
      {pawns.map(p => {
        const key = pawnKey(p.color, p.index);
        const offset = p.stackIndex * cell * 0.18;
        return (
          <Pawn
            key={key}
            color={theme.palette.players[p.color]}
            glyph={characterGlyph(p.color)}
            cell={cell}
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
  );
}

const styles = StyleSheet.create({
  board: {borderRadius: 10, overflow: 'hidden'},
  abs: {position: 'absolute'},
  baseInner: {flex: 1, borderWidth: 3},
  slot: {borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)'},
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tri: {width: 0, height: 0, borderColor: 'transparent'},
});
