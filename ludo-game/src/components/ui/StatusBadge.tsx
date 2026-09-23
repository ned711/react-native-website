import {StyleSheet, View} from 'react-native';
import type {FeatureStatus} from '../../config/featureStatus.ts';
import {AppText} from './AppText.tsx';

const COLORS: Readonly<Record<FeatureStatus, string>> = {
  IMPLEMENTÉ: '#2E7D32',
  PRÉPARÉ: '#1565C0',
  PLACEHOLDER: '#6D4C41',
  'NON CONFIGURÉ': '#B26A00',
  'À FAIRE': '#616161',
};

export function StatusBadge({status}: {readonly status: FeatureStatus}) {
  return (
    <View
      style={[styles.badge, {backgroundColor: COLORS[status]}]}
      accessibilityLabel={`Statut : ${status}`}>
      <AppText variant="caption" color="#FFFFFF" style={styles.text}>
        {status}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {fontWeight: '700'},
});
