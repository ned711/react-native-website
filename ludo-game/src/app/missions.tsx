import {StyleSheet, View} from 'react-native';
import {AppText} from '../components/ui/AppText.tsx';
import {Card} from '../components/ui/Card.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {StatusBadge} from '../components/ui/StatusBadge.tsx';
import {ACHIEVEMENTS} from '../progression/achievements.ts';
import {MISSIONS} from '../progression/missions.ts';

const PERIOD: Readonly<Record<string, string>> = {
  daily: 'Quotidienne',
  weekly: 'Hebdomadaire',
  event: 'Événement',
};

export default function MissionsScreen() {
  return (
    <Screen title="Missions et succès">
      <Card>
        <StatusBadge status="PRÉPARÉ" />
        <AppText muted variant="caption">
          Définitions et calcul de progression implémentés et testés. Le suivi
          et l’attribution des récompenses côté serveur restent à faire : aucune
          progression n’est affichée pour ne rien simuler.
        </AppText>
      </Card>
      {MISSIONS.map(m => (
        <Card key={m.id}>
          <View style={styles.row}>
            <AppText style={styles.flex}>{m.label}</AppText>
            <AppText variant="caption" muted>
              {PERIOD[m.period]}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            Objectif : {m.target} · Récompense : {m.reward.xp ?? 0} XP
          </AppText>
        </Card>
      ))}
      <AppText variant="heading">Succès</AppText>
      {ACHIEVEMENTS.map(a => (
        <Card key={a.id}>
          <AppText>{a.label}</AppText>
          <AppText variant="caption" muted>
            Récompense : {a.reward.xp ?? 0} XP
            {a.reward.titleId ? ` · titre « ${a.reward.titleId} »` : ''}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  flex: {flex: 1},
});
