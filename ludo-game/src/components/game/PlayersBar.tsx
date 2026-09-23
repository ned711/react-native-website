import {StyleSheet, View} from 'react-native';
import type {GameState} from '../../game/types.ts';
import type {ThemeDefinition} from '../../themes/types.ts';
import {AppText} from '../ui/AppText.tsx';

export function PlayersBar({
  state,
  theme,
}: {
  readonly state: GameState;
  readonly theme: ThemeDefinition;
}) {
  return (
    <View style={styles.row} accessibilityRole="summary">
      {state.players.map(player => {
        const current =
          state.currentColor === player.color &&
          state.phase.kind !== 'finished';
        const place = state.finishOrder.indexOf(player.color);
        const inDuel = state.duel?.colors.includes(player.color) ?? false;
        const finishedPawns = state.pawns[player.color].filter(
          p => p === 57
        ).length;
        const status =
          player.status === 'finished'
            ? `${place + 1}${place === 0 ? 'er' : 'e'} · spectateur`
            : player.status === 'left'
              ? 'a quitté'
              : `${finishedPawns}/4${player.skipTurns > 0 ? ` · passe ${player.skipTurns}` : ''}`;
        return (
          <View
            key={player.color}
            accessibilityLabel={`${player.displayName}, ${status}${current ? ', joue' : ''}`}
            style={[
              styles.chip,
              {
                backgroundColor: theme.palette.surface,
                borderColor: current
                  ? '#FFFFFF'
                  : theme.palette.players[player.color].main,
                borderWidth: current ? 3 : 1,
              },
            ]}>
            <View
              style={[
                styles.dot,
                {backgroundColor: theme.palette.players[player.color].main},
              ]}
            />
            <View style={styles.flex}>
              <AppText variant="caption" numberOfLines={1} style={styles.bold}>
                {player.displayName}
                {player.controller.kind === 'ai' ? ' · IA' : ''}
              </AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {inDuel ? 'DUEL · ' : ''}
                {status}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: '48.5%',
  },
  dot: {width: 12, height: 12, borderRadius: 6},
  flex: {flex: 1},
  bold: {fontWeight: '700'},
});
