import {router, useLocalSearchParams} from 'expo-router';
import {StyleSheet, View} from 'react-native';
import {GameView} from '../components/game/GameView.tsx';
import {AppText} from '../components/ui/AppText.tsx';
import {Button} from '../components/ui/Button.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {useOnlineMatch} from '../hooks/useOnlineMatch.ts';
import {useAuth} from '../state/auth.tsx';

function OnlineGame({
  matchId,
  userId,
}: {
  readonly matchId: string;
  readonly userId: string;
}) {
  const online = useOnlineMatch(matchId, userId);
  const {connection, lastError} = online.snapshot;
  const banner =
    connection.kind !== 'connected' || lastError ? (
      <View style={styles.banner}>
        <AppText variant="caption" color="#FFFFFF" style={styles.flex}>
          {connection.kind === 'reconnecting'
            ? `Reconnexion… (tentative ${connection.attempt}) – la partie continue sur le serveur`
            : connection.kind === 'offline'
              ? 'Hors ligne'
              : `Erreur : ${lastError ?? ''}`}
        </AppText>
        {connection.kind === 'offline' ? (
          <Button label="Réessayer" onPress={online.retry} />
        ) : null}
      </View>
    ) : null;
  if (!online.game) {
    return (
      <Screen title="Partie en ligne">
        {banner}
        <AppText>Chargement de la partie…</AppText>
      </Screen>
    );
  }
  return (
    <GameView
      game={{...online.game, onQuit: () => router.back()}}
      banner={banner}
    />
  );
}

export default function OnlineGameScreen() {
  const {matchId} = useLocalSearchParams<{matchId?: string}>();
  const {session} = useAuth();
  if (!session || typeof matchId !== 'string') {
    return (
      <Screen title="Partie en ligne">
        <AppText>Connexion requise.</AppText>
      </Screen>
    );
  }
  return <OnlineGame matchId={matchId} userId={session.user.id} />;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#B26A00',
    borderRadius: 10,
    padding: 8,
  },
  flex: {flex: 1},
});
