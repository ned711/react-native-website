import {Modal, StyleSheet, View} from 'react-native';
import type {GameState, PlayerColor} from '../../game/types.ts';
import type {ThemeDefinition} from '../../themes/types.ts';
import {AppText} from '../ui/AppText.tsx';
import {Button} from '../ui/Button.tsx';
import {GOLD} from '../ui/theme.ts';

export function FinishedPrompt({
  color,
  state,
  theme,
  onStay,
  onLeave,
}: {
  readonly color: PlayerColor;
  readonly state: GameState;
  readonly theme: ThemeDefinition;
  readonly onStay: () => void;
  readonly onLeave: () => void;
}) {
  const place = state.finishOrder.indexOf(color) + 1;
  const name = state.players.find(p => p.color === color)?.displayName ?? color;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.box,
            {backgroundColor: theme.palette.surface, borderColor: GOLD},
          ]}>
          <AppText variant="title" color={GOLD} accessibilityRole="header">
            {place === 1 ? 'VICTOIRE !' : 'TERMINÉ !'}
          </AppText>
          <AppText>
            {name} termine {place === 1 ? '1er' : `${place}e`}. La partie
            continue pour les autres joueurs.
          </AppText>
          <AppText variant="caption" muted>
            Récompenses, XP et animation de victoire : disponibles uniquement en
            ligne (serveur) et avec les assets 3D.
          </AppText>
          <Button label="RESTER POUR REGARDER" onPress={onStay} />
          <Button
            label="QUITTER LA PARTIE"
            variant="secondary"
            onPress={onLeave}
          />
        </View>
      </View>
    </Modal>
  );
}

export function FinalRanking({
  state,
  theme,
  onClose,
}: {
  readonly state: GameState;
  readonly theme: ThemeDefinition;
  readonly onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.box,
            {backgroundColor: theme.palette.surface, borderColor: GOLD},
          ]}>
          <AppText variant="title" color={GOLD} accessibilityRole="header">
            Classement final
          </AppText>
          {state.rankings.map(r => {
            const player = state.players.find(p => p.color === r.color);
            const outcome =
              r.outcome === 'finished'
                ? 'terminé'
                : r.outcome === 'left'
                  ? 'a quitté'
                  : 'non terminé';
            return (
              <View key={r.color} style={styles.line}>
                <AppText variant="heading" style={styles.rank}>
                  {r.rank}
                </AppText>
                <View
                  style={[
                    styles.dot,
                    {backgroundColor: theme.palette.players[r.color].main},
                  ]}
                />
                <AppText style={styles.flex}>
                  {player?.displayName ?? r.color}
                </AppText>
                <AppText variant="caption" muted>
                  {outcome}
                </AppText>
              </View>
            );
          })}
          <Button label="RETOUR" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 2,
    padding: 20,
    gap: 12,
  },
  line: {flexDirection: 'row', alignItems: 'center', gap: 10},
  rank: {width: 28},
  dot: {width: 14, height: 14, borderRadius: 7},
  flex: {flex: 1},
});
