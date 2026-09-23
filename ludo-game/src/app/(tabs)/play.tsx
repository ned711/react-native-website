import {router} from 'expo-router';
import {useState} from 'react';
import {Switch, TextInput, View, StyleSheet} from 'react-native';
import {AppText} from '../../components/ui/AppText.tsx';
import {Button} from '../../components/ui/Button.tsx';
import {Card} from '../../components/ui/Card.tsx';
import {Screen} from '../../components/ui/Screen.tsx';
import {Segmented} from '../../components/ui/Segmented.tsx';
import {StatusBadge} from '../../components/ui/StatusBadge.tsx';
import {useActiveTheme} from '../../components/ui/theme.ts';
import {isValidAdventureSeed} from '../../game/adventure/generator.ts';
import type {MatchFormat} from '../../game/rules/seats.ts';
import type {AiDifficulty, EndGameMode} from '../../game/types.ts';
import {backendStatus} from '../../services/backend.ts';
import {
  DEFAULT_SETUP,
  setMatchSetup,
  type PlayMode,
} from '../../state/matchSetup.ts';
import {useSettings} from '../../state/settings.tsx';
import {THEMES} from '../../themes/themes.ts';
import type {ThemeId} from '../../themes/types.ts';

const SEATS: Readonly<Record<MatchFormat, number>> = {
  '2p': 2,
  '3p': 3,
  '4p': 4,
  '2v2': 4,
};

export default function PlayScreen() {
  const theme = useActiveTheme();
  const {settings, update} = useSettings();
  const [mode, setMode] = useState<PlayMode | 'online'>('vs_computer');
  const [format, setFormat] = useState<MatchFormat>(DEFAULT_SETUP.format);
  const [humans, setHumans] = useState(2);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal');
  const [endMode, setEndMode] = useState<EndGameMode>('all_players');
  const [adventure, setAdventure] = useState(false);
  const [seed, setSeed] = useState('');
  const online = backendStatus();
  const seats = SEATS[format];
  const seedInvalid =
    adventure && seed.length > 0 && !isValidAdventureSeed(seed.toUpperCase());

  const start = () => {
    if (mode === 'online') return;
    setMatchSetup({
      playMode: mode,
      format,
      humanSeats: mode === 'vs_computer' ? 1 : Math.min(humans, seats),
      aiDifficulty: difficulty,
      endGameMode: endMode,
      adventure,
      adventureSeed: adventure && seed ? seed.toUpperCase() : null,
    });
    router.push('/game');
  };

  return (
    <Screen title="Jouer" subtitle="Choisissez votre mode de jeu">
      <Card>
        <AppText variant="label">Mode</AppText>
        <Segmented
          accessibilityLabel="Mode de jeu"
          value={mode}
          onChange={setMode}
          options={[
            {value: 'vs_computer', label: 'Contre l’ordinateur'},
            {value: 'local', label: 'Local (même appareil)'},
            {value: 'online', label: 'En ligne'},
          ]}
        />
        {mode === 'online' ? (
          <View style={styles.gap}>
            <StatusBadge
              status={online.configured ? 'PRÉPARÉ' : 'NON CONFIGURÉ'}
            />
            <AppText muted variant="caption">
              {online.configured
                ? 'Le serveur autoritaire (Edge Function match-action) doit être déployé. Les salles privées et le matchmaking passent par le serveur ; ils n’ont pas été testés contre un projet Supabase réel.'
                : online.reason}
            </AppText>
          </View>
        ) : null}
      </Card>

      {mode !== 'online' ? (
        <>
          <Card>
            <AppText variant="label">Joueurs</AppText>
            <Segmented
              accessibilityLabel="Nombre de joueurs"
              value={format}
              onChange={setFormat}
              options={[
                {value: '2p', label: '2 joueurs'},
                {value: '3p', label: '3 joueurs'},
                {value: '4p', label: '4 joueurs'},
                {value: '2v2', label: 'Équipes 2v2'},
              ]}
            />
            {mode === 'local' ? (
              <>
                <AppText variant="label">
                  Humains sur cet appareil (les autres sièges sont des IA)
                </AppText>
                <Segmented
                  accessibilityLabel="Nombre de joueurs humains"
                  value={String(Math.min(humans, seats))}
                  onChange={v => setHumans(Number(v))}
                  options={Array.from({length: seats}, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                />
              </>
            ) : null}
            <AppText variant="label">Niveau de l’ordinateur</AppText>
            <Segmented
              accessibilityLabel="Difficulté de l'IA"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                {value: 'easy', label: 'Facile'},
                {value: 'normal', label: 'Normal'},
                {value: 'hard', label: 'Difficile'},
              ]}
            />
          </Card>

          <Card>
            <AppText variant="label">Fin de partie</AppText>
            <Segmented
              accessibilityLabel="Fin de partie"
              value={endMode}
              onChange={setEndMode}
              options={[
                {value: 'all_players', label: 'Tous terminent'},
                {value: 'top_two', label: 'Top 2'},
                {
                  value: 'top_two_final_duel',
                  label: 'Top 2 + Duel final',
                  disabled: format === '2v2',
                },
              ]}
            />
            {format === '2v2' ? (
              <AppText muted variant="caption">
                En 2v2, la première équipe dont les deux joueurs ont terminé
                gagne.
              </AppText>
            ) : null}
          </Card>

          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="label">Mode Adventure (Jeu de l’Oie)</AppText>
                <AppText muted variant="caption">
                  Cases à événements générées par une seed, identiques pour
                  chaque joueur.
                </AppText>
              </View>
              <Switch
                accessibilityLabel="Activer le mode Adventure"
                value={adventure}
                onValueChange={setAdventure}
              />
            </View>
            {adventure ? (
              <>
                <TextInput
                  accessibilityLabel="Seed Adventure (optionnelle)"
                  placeholder="Seed optionnelle, ex. LUDO-847291"
                  placeholderTextColor={theme.palette.textMuted}
                  autoCapitalize="characters"
                  value={seed}
                  onChangeText={setSeed}
                  style={[
                    styles.input,
                    {
                      color: theme.palette.text,
                      borderColor: theme.palette.surfaceAlt,
                    },
                  ]}
                />
                {seedInvalid ? (
                  <AppText variant="caption" color="#FF8A80">
                    Seed invalide : une seed aléatoire sera utilisée.
                  </AppText>
                ) : null}
              </>
            ) : null}
          </Card>

          <Card>
            <AppText variant="label">Thème</AppText>
            <Segmented
              accessibilityLabel="Thème du plateau"
              value={settings.themeId}
              onChange={(id: ThemeId) => update({themeId: id})}
              options={THEMES.map(t => ({value: t.id, label: t.displayName}))}
            />
          </Card>

          <Button big label="LANCER LA PARTIE" onPress={start} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: {gap: 6},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  flex: {flex: 1},
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
});
