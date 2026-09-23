import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {DiceFace} from '../../components/dice/Dice.tsx';
import {AppText} from '../../components/ui/AppText.tsx';
import {Card} from '../../components/ui/Card.tsx';
import {Screen} from '../../components/ui/Screen.tsx';
import {Segmented} from '../../components/ui/Segmented.tsx';
import {StatusBadge} from '../../components/ui/StatusBadge.tsx';
import {CHARACTERS} from '../../content/characters.ts';
import {DICE, getDice} from '../../content/dice.ts';
import {isOwned} from '../../inventory/inventory.ts';
import {BADGE_TIERS, badgeForLevel} from '../../progression/badges.ts';
import {levelFromXp} from '../../progression/levels.ts';
import {loadCountries, setCountryOnServer} from '../../services/profile.ts';
import {formatTag} from '../../social/friends/tag.ts';
import {useLocalStats} from '../../state/localStats.tsx';
import {useProfile} from '../../state/profile.tsx';
import {useSettings} from '../../state/settings.tsx';

function Stats({
  items,
}: {
  readonly items: readonly (readonly [string, number])[];
}) {
  return (
    <View style={styles.stats}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <AppText variant="heading">{String(value)}</AppText>
          <AppText variant="caption" muted>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const {stats} = useLocalStats();
  const {settings} = useSettings();
  const {profile, inventory, equip, refresh} = useProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [countries, setCountries] = useState<{code: string; name: string}[]>(
    []
  );
  useEffect(() => {
    if (profile) loadCountries().then(setCountries);
  }, [profile]);

  const ownedCharacters = CHARACTERS.filter(c => isOwned(inventory, c.id));
  const ownedDice = DICE.filter(d => isOwned(inventory, d.id));
  const doEquip = async (slot: 'character' | 'dice', id: string) =>
    setMessage(await equip(slot, id));
  const progress = profile ? levelFromXp(profile.xp) : null;

  return (
    <Screen
      title="Profil"
      subtitle={
        profile
          ? formatTag({
              username: profile.username,
              discriminator: profile.discriminator,
            })
          : 'Invité (hors ligne)'
      }>
      {profile && progress ? (
        <Card>
          <AppText variant="label">Niveau (serveur)</AppText>
          <View style={styles.row}>
            <View
              style={[
                styles.badge,
                {backgroundColor: badgeForLevel(profile.level).color},
              ]}
            />
            <AppText>
              {badgeForLevel(profile.level).label} · Niveau {profile.level}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            {progress.xpForNextLevel === null
              ? `${profile.xp} XP (niveau max)`
              : `${progress.xpIntoLevel}/${progress.xpForNextLevel} XP`}{' '}
            · {profile.coins} pièces · {profile.gems} gemmes
          </AppText>
          <Stats
            items={[
              ['Parties', profile.stats.matchesPlayed],
              ['Victoires', profile.stats.wins],
              ['Captures', profile.stats.captures],
              ['Meilleure série', profile.stats.bestStreak],
            ]}
          />
          <AppText variant="label">Pays (choix explicite)</AppText>
          <Segmented
            accessibilityLabel="Pays"
            value={profile.countryCode ?? ''}
            onChange={async code => {
              const r = await setCountryOnServer(code);
              setMessage(r.ok ? null : r.error);
              await refresh();
            }}
            options={countries.map(c => ({value: c.code, label: c.name}))}
          />
        </Card>
      ) : (
        <Card>
          <AppText variant="label">Statistiques locales</AppText>
          <AppText muted variant="caption">
            Parties jouées sur cet appareil. Elles ne donnent ni XP ni
            classement (réservés au serveur).
          </AppText>
          <Stats
            items={[
              ['Parties', stats.gamesPlayed],
              ['Victoires', stats.wins],
              ['Captures', stats.captures],
              ['Pions arrivés', stats.pawnsFinished],
            ]}
          />
          <StatusBadge status="NON CONFIGURÉ" />
          <AppText muted variant="caption">
            Niveau, XP et insigne sont calculés par le serveur : connectez-vous
            (Accueil → avatar).
          </AppText>
        </Card>
      )}

      <Card>
        <AppText variant="label">Personnage équipé</AppText>
        <Segmented
          accessibilityLabel="Personnage équipé"
          value={settings.equippedCharacterId}
          onChange={id => void doEquip('character', id)}
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
            onChange={id => void doEquip('dice', id)}
            options={ownedDice.map(d => ({value: d.id, label: d.name}))}
          />
        </View>
        <AppText muted variant="caption">
          Les objets équipés sont purement cosmétiques et ne modifient jamais le
          jeu.
          {profile
            ? ' Équipement validé par le serveur (possession vérifiée).'
            : ''}
        </AppText>
        {message ? <AppText variant="caption">{message}</AppText> : null}
      </Card>

      <Card>
        <AppText variant="label">Paliers d’insignes (cosmétiques)</AppText>
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
