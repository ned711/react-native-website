import {useState} from 'react';
import {StyleSheet, TextInput} from 'react-native';
import {AppText} from '../components/ui/AppText.tsx';
import {Button} from '../components/ui/Button.tsx';
import {Card} from '../components/ui/Card.tsx';
import {NotConfigured} from '../components/ui/NotConfigured.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {StatusBadge} from '../components/ui/StatusBadge.tsx';
import {useActiveTheme} from '../components/ui/theme.ts';
import {backendStatus} from '../services/backend.ts';
import {useAuth} from '../state/auth.tsx';

export default function AccountScreen() {
  const backend = backendStatus();
  const auth = useAuth();
  const theme = useActiveTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!backend.configured) {
    return (
      <Screen title="Compte">
        <NotConfigured
          feature="Connexion (Supabase Auth)"
          reason={backend.reason}
        />
      </Screen>
    );
  }
  const inputStyle = [
    styles.input,
    {color: theme.palette.text, borderColor: theme.palette.surfaceAlt},
  ];
  if (auth.session) {
    return (
      <Screen title="Compte">
        <Card>
          <AppText>
            Connecté : {auth.session.user.email ?? auth.session.user.id}
          </AppText>
          <Button
            label="Se déconnecter"
            variant="secondary"
            onPress={() => void auth.signOut()}
          />
        </Card>
      </Screen>
    );
  }
  const submit = async () => {
    const error =
      mode === 'signin'
        ? await auth.signIn(email.trim(), password)
        : await auth.signUp(email.trim(), password, username.trim());
    setMessage(
      error ??
        (mode === 'signup'
          ? 'Compte créé. Vérifiez vos e-mails si la confirmation est activée.'
          : null)
    );
  };
  return (
    <Screen title="Compte">
      <StatusBadge status="PRÉPARÉ" />
      <Card>
        <TextInput
          accessibilityLabel="E-mail"
          placeholder="E-mail"
          placeholderTextColor={theme.palette.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          accessibilityLabel="Mot de passe"
          placeholder="Mot de passe"
          placeholderTextColor={theme.palette.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />
        {mode === 'signup' ? (
          <TextInput
            accessibilityLabel="Pseudo"
            placeholder="Pseudo (3 à 16 caractères)"
            placeholderTextColor={theme.palette.textMuted}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            style={inputStyle}
          />
        ) : null}
        <Button
          label={mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
          onPress={() => void submit()}
        />
        <Button
          label={
            mode === 'signin'
              ? 'Pas de compte ? Inscription'
              : 'Déjà un compte ? Connexion'
          }
          variant="ghost"
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        />
        {message ? <AppText variant="caption">{message}</AppText> : null}
      </Card>
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
});
