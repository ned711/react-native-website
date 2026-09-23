import {useEffect, useState} from 'react';
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
import {formatTag, parseTag} from '../../social/friends/tag.ts';

export default function FriendsScreen() {
  const backend = backendStatus();
  const theme = useActiveTheme();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [tag, setTag] = useState('');

  useEffect(() => {
    if (!backend.configured) return;
    listFriends().then(r =>
      r.ok ? setFriends(r.value) : setMessage(r.error.message)
    );
  }, [backend.configured]);

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

  const add = async () => {
    const parsed = parseTag(tag);
    if (!parsed) {
      setMessage('Format attendu : PSEUDO#1234');
      return;
    }
    const r = await sendFriendRequest(parsed.username, parsed.discriminator);
    setMessage(
      r.ok ? `Demande envoyée à ${formatTag(parsed)}` : r.error.message
    );
  };

  return (
    <Screen title="Amis">
      <StatusBadge status="PRÉPARÉ" />
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
        <Button label="Envoyer la demande" onPress={add} />
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
        </Card>
      ))}
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
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  presence: {width: 10, height: 10, borderRadius: 5},
  flex: {flex: 1},
});
