import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {AppText} from '../components/ui/AppText.tsx';
import {Card} from '../components/ui/Card.tsx';
import {NotConfigured} from '../components/ui/NotConfigured.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {Segmented} from '../components/ui/Segmented.tsx';
import {backendStatus} from '../services/backend.ts';
import {supabaseRankingService} from '../services/rpc.ts';
import type {RankingEntry, RankingScope} from '../social/rankings/types.ts';

export default function RankingsScreen() {
  const backend = backendStatus();
  const [scope, setScope] = useState<RankingScope>('world');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [mine, setMine] = useState<RankingEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend.configured) return;
    const service = supabaseRankingService;
    const load =
      scope === 'world'
        ? service.getWorldRanking(50)
        : scope === 'continent'
          ? service.getContinentRanking(50)
          : service.getCountryRanking(50);
    Promise.all([load, service.getMyRank(scope)])
      .then(([list, me]) => {
        setEntries(list);
        setMine(me);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, [backend.configured, scope]);

  if (!backend.configured) {
    return (
      <Screen title="Classements">
        <NotConfigured
          feature="Classements pays, continent et monde"
          reason={backend.reason}
        />
      </Screen>
    );
  }
  return (
    <Screen title="Classements">
      <Segmented
        accessibilityLabel="Portée du classement"
        value={scope}
        onChange={setScope}
        options={[
          {value: 'world', label: 'Monde'},
          {value: 'continent', label: 'Continent'},
          {value: 'country', label: 'Pays'},
        ]}
      />
      {error ? <AppText>{error}</AppText> : null}
      {mine ? (
        <Card>
          <AppText variant="label">Votre rang : #{mine.rank}</AppText>
        </Card>
      ) : null}
      {entries.map(e => (
        <View key={e.userId} style={styles.row}>
          <AppText style={styles.rank}>#{e.rank}</AppText>
          <AppText style={styles.flex}>
            {e.username}#{e.discriminator}
          </AppText>
          <AppText muted>{e.score}</AppText>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  rank: {width: 48},
  flex: {flex: 1},
});
