import {router} from 'expo-router';
import {useCallback, useEffect, useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {AppText} from '../../components/ui/AppText.tsx';
import {Button} from '../../components/ui/Button.tsx';
import {Card} from '../../components/ui/Card.tsx';
import {NotConfigured} from '../../components/ui/NotConfigured.tsx';
import {Screen} from '../../components/ui/Screen.tsx';
import {StatusBadge} from '../../components/ui/StatusBadge.tsx';
import {useActiveTheme} from '../../components/ui/theme.ts';
import {backendStatus} from '../../services/backend.ts';
import {
  listFriends,
  sendFriendRequest,
  type FriendRow,
} from '../../services/rpc.ts';
import {
  blockUser,
  incomingInvitations,
  incomingRequests,
  removeFriend,
  respondFriendRequest,
  respondInvitation,
  type PendingInvitation,
  type PendingRequest,
} from '../../services/social.ts';
import {formatTag, parseTag} from '../../social/friends/tag.ts';
import {invitationText} from '../../social/invitations/invitations.ts';
import {useAuth} from '../../state/auth.tsx';

function SignedInFriends({userId}: {readonly userId: string}) {
  const theme = useActiveTheme();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [tag, setTag] = useState('');

  const load = useCallback(async () => {
    const [f, r, i] = await Promise.all([
      listFriends(),
      incomingRequests(userId),
      incomingInvitations(userId),
    ]);
    if (f.ok) setFriends(f.value);
    if (r.ok) setRequests(r.value);
    if (i.ok) setInvitations(i.value);
    const firstError = !f.ok
      ? f.error.message
      : !r.ok
        ? r.error
        : !i.ok
          ? i.error
          : null;
    if (firstError) setMessage(firstError);
  }, [userId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (p: Promise<{ok: boolean; error?: unknown}>) => {
    const r = await p;
    if (!r.ok) setMessage(String(r.error));
    await load();
  };

  const add = async () => {
    const parsed = parseTag(tag);
    if (!parsed) return setMessage('Format attendu : PSEUDO#1234');
    const r = await sendFriendRequest(parsed.username, parsed.discriminator);
    setMessage(
      r.ok ? `Demande envoyée à ${formatTag(parsed)}` : r.error.message
    );
    if (r.ok) setTag('');
  };

  return (
    <>
      <StatusBadge status="PRÉPARÉ" />
      {invitations.map(inv => (
        <Card key={inv.id}>
          <AppText>{invitationText(inv.fromName)}</AppText>
          <View style={styles.row}>
            <Button
              label="Accepter"
              onPress={async () => {
                const r = await respondInvitation(inv.id, true);
                if (r.ok && r.value)
                  router.push({pathname: '/online', params: {roomId: r.value}});
                else setMessage(r.ok ? 'Invitation expirée' : r.error);
                await load();
              }}
            />
            <Button
              label="Refuser"
              variant="secondary"
              onPress={() => void act(respondInvitation(inv.id, false))}
            />
          </View>
        </Card>
      ))}
      {requests.map(req => (
        <Card key={req.id}>
          <AppText>Demande d’ami de {req.fromName}</AppText>
          <View style={styles.row}>
            <Button
              label="Accepter"
              onPress={() => void act(respondFriendRequest(req.id, true))}
            />
            <Button
              label="Refuser"
              variant="secondary"
              onPress={() => void act(respondFriendRequest(req.id, false))}
            />
            <Button
              label="Bloquer"
              variant="ghost"
              onPress={() => void act(blockUser(req.fromId))}
            />
          </View>
        </Card>
      ))}
      <Card>
        <AppText variant="label">Ajouter un ami</AppText>
        <TextInput
          accessibilityLabel="Identifiant de l'ami"
          placeholder="NASSER#4827"
          placeholderTextColor={theme.palette.textMuted}
          autoCapitalize="characters"
          value={tag}
          onChangeText={setTag}
          style={[
            styles.input,
            {color: theme.palette.text, borderColor: theme.palette.surfaceAlt},
          ]}
        />
        <Button label="Envoyer la demande" onPress={() => void add()} />
        {message ? <AppText variant="caption">{message}</AppText> : null}
      </Card>
      {friends.map(f => (
        <Card key={f.userId}>
          <View style={styles.row}>
            <View
              style={[
                styles.presence,
                {backgroundColor: f.online ? '#4CAF50' : '#9E9E9E'},
              ]}
            />
            <AppText style={styles.flex}>
              {formatTag({
                username: f.username,
                discriminator: f.discriminator,
              })}
            </AppText>
            <AppText muted>Niv. {f.level}</AppText>
          </View>
          <View style={styles.row}>
            <Button
              label="Retirer"
              variant="secondary"
              onPress={() => void act(removeFriend(f.userId))}
            />
            <Button
              label="Bloquer"
              variant="ghost"
              onPress={() => void act(blockUser(f.userId))}
            />
          </View>
        </Card>
      ))}
    </>
  );
}

export default function FriendsScreen() {
  const backend = backendStatus();
  const {session} = useAuth();
  if (!backend.configured) {
    return (
      <Screen title="Amis">
        <NotConfigured
          feature="Amis, invitations, chat et cadeaux"
          reason={backend.reason}
        />
      </Screen>
    );
  }
  return (
    <Screen title="Amis">
      {session ? (
        <SignedInFriends userId={session.user.id} />
      ) : (
        <Card>
          <AppText>Connectez-vous pour gérer vos amis.</AppText>
          <Button
            label="Se connecter"
            onPress={() => router.push('/account')}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  presence: {width: 10, height: 10, borderRadius: 5},
  flex: {flex: 1},
});
