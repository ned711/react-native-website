import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet, View} from 'react-native';
import type {GameState, PlayerColor} from '../../game/types.ts';
import type {ThemeDefinition} from '../../themes/types.ts';
import {AppText} from '../ui/AppText.tsx';
import {GOLD} from '../ui/theme.ts';

/** Corner card: avatar placeholder, name and status of one seat. */
export function PlayerCard({
  state,
  color,
  theme,
  size,
}: {
  readonly state: GameState;
  readonly color: PlayerColor;
  readonly theme: ThemeDefinition;
  readonly size: number;
}) {
  const player = state.players.find(p => p.color === color);
  if (!player) return <View style={{width: size}} />;
  const colors = theme.palette.players[color];
  const active =
    state.currentColor === color && state.phase.kind !== 'finished';
  const place = state.finishOrder.indexOf(color);
  const finished = state.pawns[color].filter(p => p === 57).length;
  const inDuel = state.duel?.colors.includes(color) ?? false;
  const status =
    player.status === 'finished'
      ? `${place + 1}${place === 0 ? 'er' : 'e'}`
      : player.status === 'left'
        ? 'parti'
        : `${inDuel ? 'DUEL · ' : ''}${finished}/4${player.skipTurns > 0 ? ` · passe ${player.skipTurns}` : ''}`;
  const initial = player.displayName.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[styles.wrap, {width: size}]}
      accessibilityLabel={`${player.displayName}, ${status}${active ? ', à son tour' : ''}`}>
      <View
        style={[
          styles.avatarFrame,
          {
            width: size,
            height: size,
            borderColor: active ? GOLD : 'rgba(255,255,255,0.35)',
          },
          active && styles.activeGlow,
        ]}>
        <LinearGradient
          colors={[colors.light, colors.main, colors.dark]}
          style={styles.avatar}>
          <AppText
            style={{
              fontSize: size * 0.42,
              color: '#FFFFFF',
              fontWeight: '900',
            }}>
            {initial}
          </AppText>
        </LinearGradient>
        {player.controller.kind === 'ai' ? (
          <View style={styles.aiBadge}>
            <AppText variant="caption" color="#FFFFFF" style={styles.bold}>
              IA
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText
        variant="caption"
        numberOfLines={1}
        style={[styles.bold, styles.center]}>
        {player.displayName}
      </AppText>
      <AppText variant="caption" muted numberOfLines={1} style={styles.center}>
        {status}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', gap: 2},
  avatarFrame: {
    borderWidth: 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  activeGlow: {
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 0},
    elevation: 8,
  },
  avatar: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  aiBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  bold: {fontWeight: '800'},
  center: {textAlign: 'center'},
});
