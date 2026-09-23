import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {AppText} from '../components/ui/AppText.tsx';
import {Card} from '../components/ui/Card.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {Segmented} from '../components/ui/Segmented.tsx';
import {StatusBadge} from '../components/ui/StatusBadge.tsx';
import {GOLD} from '../components/ui/theme.ts';
import {CATALOG, type ItemCategory} from '../inventory/catalog.ts';

const CATEGORIES: readonly {value: ItemCategory; label: string}[] = [
  {value: 'board', label: 'Plateaux'},
  {value: 'dice', label: 'Dés'},
  {value: 'character', label: 'Personnages'},
  {value: 'gift', label: 'Cadeaux'},
];

export default function ShopScreen() {
  const [category, setCategory] = useState<ItemCategory>('board');
  const items = CATALOG.filter(i => i.category === category);
  return (
    <Screen
      title="Boutique"
      subtitle="Objets 100 % cosmétiques : aucun avantage de jeu">
      <Card>
        <StatusBadge status="NON CONFIGURÉ" />
        <AppText muted variant="caption">
          Aucun prix n’est encore défini et aucun fournisseur de paiement n’est
          configuré : rien ne peut être acheté. Les aperçus 3D (rotation, zoom,
          effet du 6) nécessitent les modèles, absents du projet.
        </AppText>
      </Card>
      <Segmented
        accessibilityLabel="Catégorie"
        value={category}
        onChange={setCategory}
        options={CATEGORIES}
      />
      {items.map(item => (
        <Card key={item.id}>
          <View style={styles.row}>
            <View
              style={[styles.preview, {borderColor: GOLD}]}
              accessibilityLabel="Aperçu 3D indisponible">
              <AppText variant="caption" muted style={styles.center}>
                3D{'\n'}placeholder
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="label">{item.name}</AppText>
              <AppText variant="caption" muted>
                Rareté : {item.rarity} ·{' '}
                {item.acquisition === 'default'
                  ? 'possédé par défaut'
                  : 'à débloquer'}
              </AppText>
              <AppText variant="caption" muted>
                Prix : non défini
              </AppText>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  preview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {textAlign: 'center'},
  flex: {flex: 1},
});
