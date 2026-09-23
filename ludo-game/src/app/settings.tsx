import {StyleSheet, Switch, View} from 'react-native';
import {AppText} from '../components/ui/AppText.tsx';
import {Card} from '../components/ui/Card.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {Segmented} from '../components/ui/Segmented.tsx';
import {StatusBadge} from '../components/ui/StatusBadge.tsx';
import {FEATURES} from '../config/featureStatus.ts';
import type {AudioSettings} from '../audio/types.ts';
import type {GraphicsQuality} from '../environment/types.ts';
import {useSettings} from '../state/settings.tsx';

const VOLUMES = ['0', '0.25', '0.5', '0.75', '1'] as const;

function ToggleRow({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <AppText style={styles.flex}>{label}</AppText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const {settings, update, updateAudio} = useSettings();
  const volumeRow = (
    label: string,
    key: keyof Pick<
      AudioSettings,
      'musicVolume' | 'effectsVolume' | 'voiceVolume'
    >
  ) => (
    <View style={styles.gap}>
      <AppText variant="label">{label}</AppText>
      <Segmented
        accessibilityLabel={label}
        value={
          String(
            Math.round(settings.audio[key] * 4) / 4
          ) as (typeof VOLUMES)[number]
        }
        onChange={v => updateAudio({[key]: Number(v)})}
        options={VOLUMES.map(v => ({value: v, label: `${Number(v) * 100}%`}))}
      />
    </View>
  );
  return (
    <Screen title="Paramètres">
      <Card>
        <AppText variant="heading">Audio</AppText>
        <StatusBadge status="PLACEHOLDER" />
        <AppText muted variant="caption">
          Moteur audio prêt ; aucun fichier son licencié n’est encore présent,
          rien n’est joué.
        </AppText>
        <ToggleRow
          label="Couper le son"
          value={settings.audio.muted}
          onChange={muted => updateAudio({muted})}
        />
        {volumeRow('Musique', 'musicVolume')}
        {volumeRow('Effets', 'effectsVolume')}
        {volumeRow('Voix', 'voiceVolume')}
        <ToggleRow
          label="Vibrations"
          value={settings.audio.vibrationEnabled}
          onChange={vibrationEnabled => updateAudio({vibrationEnabled})}
        />
      </Card>
      <Card>
        <AppText variant="heading">Affichage et accessibilité</AppText>
        <ToggleRow
          label="Réduire les animations"
          value={settings.reduceMotion}
          onChange={reduceMotion => update({reduceMotion})}
        />
        <ToggleRow
          label="Texte agrandi"
          value={settings.largeText}
          onChange={largeText => update({largeText})}
        />
        <AppText variant="label">Qualité graphique</AppText>
        <Segmented
          accessibilityLabel="Qualité graphique"
          value={settings.graphics}
          onChange={(graphics: GraphicsQuality) => update({graphics})}
          options={[
            {value: 'LOW', label: 'Basse'},
            {value: 'NORMAL', label: 'Normale'},
            {value: 'HIGH', label: 'Haute'},
          ]}
        />
      </Card>
      <Card>
        <AppText variant="heading">État du projet</AppText>
        {FEATURES.map(f => (
          <View key={f.id} style={styles.feature}>
            <View style={styles.row}>
              <AppText style={styles.flex}>{f.label}</AppText>
              <StatusBadge status={f.status} />
            </View>
            {f.note ? (
              <AppText variant="caption" muted>
                {f.note}
              </AppText>
            ) : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44},
  flex: {flex: 1},
  gap: {gap: 6},
  feature: {gap: 2, paddingVertical: 4},
});
