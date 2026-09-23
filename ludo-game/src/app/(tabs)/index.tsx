import {router, type Href} from 'expo-router';
import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../components/ui/AppText.tsx';
import {Button} from '../../components/ui/Button.tsx';
import {Card} from '../../components/ui/Card.tsx';
import {Screen} from '../../components/ui/Screen.tsx';
import {StatusBadge} from '../../components/ui/StatusBadge.tsx';
import {GOLD, useActiveTheme} from '../../components/ui/theme.ts';
import {getCharacter} from '../../content/characters.ts';
import {backendStatus} from '../../services/backend.ts';
import {useSettings} from '../../state/settings.tsx';

const SECTIONS: readonly {label: string; href: Href; glyph: string}[] = [
  {label: 'Jouer', href: '/play', glyph: '▶'},
  {label: 'Amis', href: '/friends', glyph: '☺'},
  {label: 'Collection', href: '/collection', glyph: '❖'},
  {label: 'Boutique', href: '/shop', glyph: '⛩'},
  {label: 'Coffre', href: '/chest', glyph: '⚱'},
  {label: 'Missions', href: '/missions', glyph: '✓'},
  {label: 'Classements', href: '/rankings', glyph: '♛'},
];

export default function HomeScreen() {
  const theme = useActiveTheme();
  const {settings} = useSettings();
  const backend = backendStatus();
  const character = getCharacter(settings.equippedCharacterId);
  return (
    <Screen>
      <View
        style={[
          styles.topBar,
          {backgroundColor: theme.palette.surface, borderColor: GOLD},
        ]}>
        <View
          style={[styles.avatar, {backgroundColor: theme.palette.accent}]}
          accessibilityLabel="Avatar invité">
          <AppText variant="heading" color="#FFFFFF">
            ?
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="label">Invité</AppText>
          <AppText variant="caption" muted>
            {backend.configured
              ? 'Connectez-vous pour votre progression'
              : 'Hors ligne · progression non synchronisée'}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
          onPress={() => router.push('/settings')}
          hitSlop={10}>
          <AppText variant="heading">⚙</AppText>
        </Pressable>
      </View>

      <Card style={[styles.hero, {borderColor: GOLD}]}>
        <AppText variant="caption" muted>
          Thème : {theme.displayName} · Personnage : {character.displayName}
        </AppText>
        <AppText variant="title">Ludo Royale</AppText>
        <Button
          big
          label="JOUER"
          onPress={() => router.push('/play')}
          accessibilityHint="Ouvre le choix du mode de jeu"
        />
      </Card>

      <View style={styles.grid}>
        {SECTIONS.map(s => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            onPress={() => router.push(s.href)}
            style={({pressed}) => [
              styles.tile,
              {
                backgroundColor: theme.palette.surface,
                borderColor: theme.palette.surfaceAlt,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <AppText variant="title" color={GOLD}>
              {s.glyph}
            </AppText>
            <AppText variant="label">{s.label}</AppText>
          </Pressable>
        ))}
      </View>

      {!backend.configured ? (
        <Card>
          <StatusBadge status="NON CONFIGURÉ" />
          <AppText muted variant="caption">
            Le jeu hors ligne (contre l'ordinateur ou à plusieurs sur cet
            appareil) est entièrement jouable. Les fonctions en ligne
            nécessitent un projet Supabase.
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {flex: 1},
  hero: {alignItems: 'stretch', gap: 12, paddingVertical: 20},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  tile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
