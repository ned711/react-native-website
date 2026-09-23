import {router} from 'expo-router';
import {useCallback, useEffect, useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {AppText} from '../components/ui/AppText.tsx';
import {Button} from '../components/ui/Button.tsx';
import {Card} from '../components/ui/Card.tsx';
import {NotConfigured} from '../components/ui/NotConfigured.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {Segmented} from '../components/ui/Segmented.tsx';
import {StatusBadge} from '../components/ui/StatusBadge.tsx';
import {GOLD, useActiveTheme} from '../components/ui/theme.ts';
import type {MatchFormat} from '../game/rules/seats.ts';
import {backendStatus} from '../services/backend.ts';
import {
  cancelQueue,
  createRoom,
  enqueue,
  joinRoom,
  leaveRoom,
  loadRoom,
  startRoomMatch,
  ticketMatch,
  type RoomView,
} from '../services/lobby.ts';
import {useAuth} from '../state/auth.tsx';

const FORMATS: readonly {value: MatchFormat; label: string}[] = [
  {value: '2p', label: '2 joueurs'},
  {value: '3p', label: '3 joueurs'},
  {value: '4p', label: '4 joueurs'},
  {value: '2v2', label: '2v2'},
];
const POLL_MS = 3000;

const openMatch = (matchId: string) =>
  router.replace({pathname: '/online-game', params: {matchId}});

export default function OnlineLobbyScreen() {
  const backend = backendStatus();
  const {session} = useAuth();
  const theme = useActiveTheme();
  const [format, setFormat] = useState<MatchFormat>('4p');
  const [code, setCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (roomId) {
      const r = await loadRoom(roomId);
      if (r.ok) {
        setRoom(r.value);
        if (r.value.matchId) openMatch(r.value.matchId);
      } else setMessage(r.error.message);
    }
    if (ticket) {
      const matchId = await ticketMatch(ticket);
      if (matchId) openMatch(matchId);
    }
  }, [roomId, ticket]);

  useEffect(() => {
    if (!roomId && !ticket) return undefined;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [roomId, ticket, refresh]);

  if (!backend.configured) {
    return (
      <Screen title="En ligne">
        <NotConfigured
          feature="Salles privées et matchmaking"
          reason={backend.reason}
        />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen title="En ligne">
        <Card>
          <AppText>Connectez-vous pour jouer en ligne.</AppText>
          <Button
            label="Se connecter"
            onPress={() => router.push('/account')}
          />
        </Card>
      </Screen>
    );
  }
  const inputStyle = [
    styles.input,
    {color: theme.palette.text, borderColor: theme.palette.surfaceAlt},
  ];

  if (roomId && room) {
    const isOwner = room.ownerId === session.user.id;
    return (
      <Screen title="Salle privée">
        <Card>
          <AppText variant="caption" muted>
            Code de la salle
          </AppText>
          <AppText
            variant="title"
            color={GOLD}
            accessibilityLabel={`Code ${room.code.split('').join(' ')}`}>
            {room.code}
          </AppText>
          <AppText muted>
            {room.members.length} joueur(s) · {room.format} · les places libres
            seront jouées par l’IA
          </AppText>
          {room.members.map(m => (
            <AppText key={m.userId}>
              {m.username}
              {m.userId === room.ownerId ? ' (propriétaire)' : ''}
            </AppText>
          ))}
          {isOwner ? (
            <Button
              label="Lancer la partie"
              onPress={async () => {
                const r = await startRoomMatch(room.id);
                if (r.ok) openMatch(r.value);
                else setMessage(r.error.message);
              }}
            />
          ) : (
            <AppText variant="caption" muted>
              En attente du lancement par le propriétaire…
            </AppText>
          )}
          <Button
            label="Quitter la salle"
            variant="secondary"
            onPress={async () => {
              await leaveRoom(room.id);
              setRoomId(null);
              setRoom(null);
            }}
          />
          {message ? <AppText variant="caption">{message}</AppText> : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="En ligne">
      <StatusBadge status="PRÉPARÉ" />
      <Card>
        <AppText variant="label">Format</AppText>
        <Segmented
          accessibilityLabel="Format"
          value={format}
          onChange={setFormat}
          options={FORMATS}
        />
      </Card>
      <Card>
        <AppText variant="heading">Salle privée</AppText>
        <Button
          label="Créer une salle"
          onPress={async () => {
            const r = await createRoom(format, 'all_players', false);
            if (r.ok) setRoomId(r.value);
            else setMessage(r.error.message);
          }}
        />
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Code de salle"
            placeholder="7K4P9"
            placeholderTextColor={theme.palette.textMuted}
            autoCapitalize="characters"
            maxLength={5}
            value={code}
            onChangeText={setCode}
            style={[inputStyle, styles.flex]}
          />
          <Button
            label="Rejoindre"
            onPress={async () => {
              const r = await joinRoom(code);
              if (r.ok) setRoomId(r.value);
              else setMessage(r.error.message);
            }}
          />
        </View>
      </Card>
      <Card>
        <AppText variant="heading">Matchmaking</AppText>
        {ticket ? (
          <>
            <AppText>
              Recherche d’adversaires… (complété par l’IA après 30 s)
            </AppText>
            <Button
              label="Annuler"
              variant="secondary"
              onPress={async () => {
                await cancelQueue();
                setTicket(null);
              }}
            />
          </>
        ) : (
          <Button
            label="Trouver une partie"
            onPress={async () => {
              const r = await enqueue(format);
              if (r.ok) setTicket(r.value);
              else setMessage(r.error.message);
            }}
          />
        )}
      </Card>
      {message ? <AppText variant="caption">{message}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  flex: {flex: 1},
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
});
