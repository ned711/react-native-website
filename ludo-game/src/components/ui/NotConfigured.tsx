import {StyleSheet, View} from 'react-native';
import {AppText} from './AppText.tsx';
import {Card} from './Card.tsx';
import {StatusBadge} from './StatusBadge.tsx';

/** Honest placeholder for features that need a backend that is not configured. */
export function NotConfigured({
  feature,
  reason,
}: {
  readonly feature: string;
  readonly reason: string;
}) {
  return (
    <Card>
      <StatusBadge status="NON CONFIGURÉ" />
      <AppText variant="heading">{feature}</AppText>
      <View style={styles.gap}>
        <AppText muted>{reason}</AppText>
        <AppText muted variant="caption">
          Aucune donnée n'est simulée. Configurez Supabase (voir README) pour
          activer cette fonctionnalité.
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({gap: {gap: 6}});
