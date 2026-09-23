import {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button} from '../components/ui/Button.tsx';
import {claimMission, myMissions, type MissionRow} from '../services/rpc.ts';
import {useAuth} from '../state/auth.tsx';
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

function ServerMissions() {
  const [rows, setRows] = useState<MissionRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await myMissions();
    if (r.ok) setRows(r.value);
    else setMessage(r.error.message);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <StatusBadge status="PRÉPARÉ" />
      {message ? <AppText variant="caption">{message}</AppText> : null}
      {rows.map(m => (
        <Card key={m.missionId}>
          <View style={styles.row}>
            <AppText style={styles.flex}>{m.label}</AppText>
            <AppText variant="caption" muted>
              {m.progress}/{m.target}
            </AppText>
          </View>
          {m.completed && !m.claimed ? (
            <Button
              label="Récupérer"
              onPress={async () => {
                const r = await claimMission(m.missionId);
                if (!r.ok) setMessage(r.error.message);
                void load();
              }}
            />
          ) : null}
          {m.claimed ? (
            <AppText variant="caption" muted>
              Récompense récupérée
            </AppText>
          ) : null}
        </Card>
      ))}
    </>
  );
}

export default function MissionsScreen() {
  const {session} = useAuth();
  if (session) {
    return (
      <Screen title="Missions et succès">
        <ServerMissions />
      </Screen>
    );
  }
  return (
    <Screen title="Missions et succès">
      <Card>
        <StatusBadge status="NON CONFIGURÉ" />
        <AppText muted variant="caption">
          La progression est suivie et récompensée par le serveur (Supabase) :
          connectez-vous pour la voir. Aucune progression n’est simulée hors
          ligne. Missions disponibles :
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
