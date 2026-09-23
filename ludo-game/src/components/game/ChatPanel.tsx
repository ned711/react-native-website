import {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import type {GameState} from '../../game/types.ts';
import {
  loadMatchChat,
  sendMatchChat,
  subscribeMatchChat,
} from '../../services/chat.ts';
import {mergeChat, type ChatMessage} from '../../social/chat/chatLog.ts';
import {MAX_CHAT_LENGTH, QUICK_MESSAGES} from '../../social/chat/messages.ts';
import {AppText} from '../ui/AppText.tsx';
import {Button} from '../ui/Button.tsx';
import {useActiveTheme} from '../ui/theme.ts';

/** Keyboard chat for online matches (players and spectators). */
export function ChatPanel({
  matchId,
  state,
}: {
  readonly matchId: string;
  readonly state: GameState;
}) {
  const theme = useActiveTheme();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadMatchChat(matchId).then(r => {
      if (alive && r.ok) setMessages(prev => mergeChat(prev, r.value));
    });
    const off = subscribeMatchChat(matchId, m =>
      setMessages(prev => mergeChat(prev, [m]))
    );
    return () => {
      alive = false;
      off();
    };
  }, [matchId]);

  const nameOf = (id: string) =>
    state.players.find(p => p.playerId === id)?.displayName ?? 'Spectateur';
  const send = async (text: string) => {
    const r = await sendMatchChat(matchId, text);
    setError(r.ok ? null : r.error);
    if (r.ok) setDraft('');
  };
  const last = messages.at(-1);

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le chat"
        onPress={() => setOpen(true)}
        style={[styles.collapsed, {backgroundColor: theme.palette.surface}]}>
        <AppText variant="caption" numberOfLines={1}>
          💬 {last ? `${nameOf(last.senderId)} : ${last.body}` : 'Chat'}
        </AppText>
      </Pressable>
    );
  }
  return (
    <View style={[styles.panel, {backgroundColor: theme.palette.surface}]}>
      <ScrollView style={styles.list}>
        {messages.map(m => (
          <AppText key={m.id} variant="caption">
            <AppText variant="caption" style={styles.bold}>
              {nameOf(m.senderId)} :{' '}
            </AppText>
            {m.body}
          </AppText>
        ))}
      </ScrollView>
      <View style={styles.row}>
        {QUICK_MESSAGES.slice(0, 3).map(q => (
          <Button
            key={q.id}
            label={q.text}
            variant="secondary"
            onPress={() => void send(q.text)}
          />
        ))}
      </View>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="Message"
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Message…"
          placeholderTextColor={theme.palette.textMuted}
          style={[
            styles.input,
            {color: theme.palette.text, borderColor: theme.palette.surfaceAlt},
          ]}
          onSubmitEditing={() => void send(draft)}
        />
        <Button label="Envoyer" onPress={() => void send(draft)} />
        <Button label="✕" variant="ghost" onPress={() => setOpen(false)} />
      </View>
      {error ? <AppText variant="caption">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: {borderRadius: 10, padding: 8},
  panel: {borderRadius: 12, padding: 8, gap: 6},
  list: {maxHeight: 120},
  row: {flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'},
  input: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  bold: {fontWeight: '700'},
});
