import {StyleSheet, View} from 'react-native';
import {DiceFace} from '../../components/dice/Dice.tsx';
import {AppText} from '../../components/ui/AppText.tsx';
import {Card} from '../../components/ui/Card.tsx';
import {Screen} from '../../components/ui/Screen.tsx';
import {Segmented} from '../../components/ui/Segmented.tsx';
import {StatusBadge} from '../../components/ui/StatusBadge.tsx';
import {CHARACTERS} from '../../content/characters.ts';
import {DICE, getDice} from '../../content/dice.ts';
import {isOwned, defaultInventory} from '../../inventory/inventory.ts';
import {BADGE_TIERS} from '../../progression/badges.ts';
import {useLocalStats} from '../../state/localStats.tsx';
import {useSettings} from '../../state/settings.tsx';

export default function ProfileScreen() {
  const {stats} = useLocalStats();
  const {settings, update} = useSettings();
  const inventory = defaultInventory();
  const ownedCharacters = CHARACTERS.filter(c => isOwned(inventory, c.id));
  const ownedDice = DICE.filter(d => isOwned(inventory, d.id));
  return (
    <Screen title="Profil" subtitle="Invité (hors ligne)">
      <Card>
        <AppText variant="label">Statistiques locales</AppText>
        <AppText muted variant="caption">
          Parties jouées sur cet appareil. Elles ne donnent ni XP ni classement
          (réservés au serveur).
        </AppText>
        <View style={styles.stats}>
          {[
            ['Parties', stats.gamesPlayed],
            ['Victoires', stats.wins],
            ['Captures', stats.captures],
            ['Pions arrivés', stats.pawnsFinished],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.stat}>
              <AppText variant="heading">{String(value)}</AppText>
              <AppText variant="caption" muted>
                {String(label)}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <AppText variant="label">Niveau, XP et insigne</AppText>
        <StatusBadge status="NON CONFIGURÉ" />
        <AppText muted variant="caption">
          Calculés et validés par le serveur. Paliers d’insignes (cosmétiques) :
        </AppText>
        {BADGE_TIERS.map(t => (
          <View key={t.id} style={styles.row}>
            <View style={[styles.badge, {backgroundColor: t.color}]} />
            <AppText variant="caption" style={styles.flex}>
              {t.label}
            </AppText>
            <AppText variant="caption" muted>
              {t.minLevel === t.maxLevel
                ? `Niv. ${t.minLevel}`
                : `Niv. ${t.minLevel}–${t.maxLevel}`}
            </AppText>
          </View>
        ))}
      </Card>

      <Card>
        <AppText variant="label">Personnage équipé</AppText>
        <Segmented
          accessibilityLabel="Personnage équipé"
          value={settings.equippedCharacterId}
          onChange={id => update({equippedCharacterId: id})}
          options={ownedCharacters.map(c => ({
            value: c.id,
            label: c.displayName,
          }))}
        />
        <AppText variant="label">Dé équipé</AppText>
        <View style={styles.row}>
          <DiceFace
            value={6}
            size={44}
            definition={getDice(settings.equippedDiceId)}
          />
          <Segmented
            accessibilityLabel="Dé équipé"
            value={settings.equippedDiceId}
            onChange={id => update({equippedDiceId: id})}
            options={ownedDice.map(d => ({value: d.id, label: d.name}))}
          />
        </View>
        <AppText muted variant="caption">
          Les objets équipés sont purement cosmétiques et ne modifient jamais le
          jeu.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {flexDirection: 'row', justifyContent: 'space-between'},
  stat: {alignItems: 'center', flex: 1},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  badge: {width: 14, height: 14, borderRadius: 7},
  flex: {flex: 1},
});
