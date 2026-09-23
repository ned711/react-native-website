import {StyleSheet, View} from 'react-native';
import {AppText} from '../../components/ui/AppText.tsx';
import {Card} from '../../components/ui/Card.tsx';
import {Screen} from '../../components/ui/Screen.tsx';
import {StatusBadge} from '../../components/ui/StatusBadge.tsx';
import {GOLD, useActiveTheme} from '../../components/ui/theme.ts';
import {collectionProgress} from '../../inventory/inventory.ts';
import type {ItemCategory} from '../../inventory/catalog.ts';
import {useProfile} from '../../state/profile.tsx';
import {THEMES} from '../../themes/themes.ts';

const CATEGORY_LABEL: Partial<Record<ItemCategory, string>> = {
  character: 'Personnages',
  dice: 'Dés',
  board: 'Plateaux',
  effect: 'Effets',
};

export default function CollectionScreen() {
  const theme = useActiveTheme();
  // Offline, only the default items are owned. Owned items come from the server inventory.
  const {inventory, profile} = useProfile();
  return (
    <Screen title="Collection" subtitle="Progression par pays et par thème">
      {!profile ? (
        <Card>
          <StatusBadge status="NON CONFIGURÉ" />
          <AppText muted variant="caption">
            L’inventaire est conservé sur le serveur. Sans connexion, seuls les
            objets classiques par défaut sont affichés comme possédés.
          </AppText>
        </Card>
      ) : null}
      {THEMES.map(t => {
        const progress = collectionProgress(inventory, t.id);
        const ratio =
          progress.total === 0 ? 0 : progress.owned / progress.total;
        return (
          <Card key={t.id}>
            <View style={styles.row}>
              <View
                style={[
                  styles.swatch,
                  {backgroundColor: t.palette.accent, borderColor: GOLD},
                ]}
              />
              <AppText variant="heading" style={styles.flex}>
                {t.displayName.toUpperCase()}
              </AppText>
              <AppText variant="heading">
                {progress.owned}/{progress.total}
              </AppText>
            </View>
            <View
              style={[styles.bar, {backgroundColor: theme.palette.surfaceAlt}]}
              accessibilityLabel={`${Math.round(ratio * 100)} pour cent`}>
              <View
                style={[
                  styles.fill,
                  {width: `${ratio * 100}%`, backgroundColor: GOLD},
                ]}
              />
            </View>
            {Object.entries(progress.byCategory).map(([category, value]) => (
              <View key={category} style={styles.row}>
                <AppText muted style={styles.flex}>
                  {CATEGORY_LABEL[category as ItemCategory] ?? category}
                </AppText>
                <AppText muted>
                  {value.owned}/{value.total}
                </AppText>
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  flex: {flex: 1},
  swatch: {width: 18, height: 18, borderRadius: 4, borderWidth: 1},
  bar: {height: 8, borderRadius: 4, overflow: 'hidden'},
  fill: {height: '100%'},
});
