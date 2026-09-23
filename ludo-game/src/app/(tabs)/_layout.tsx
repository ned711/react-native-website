import {Tabs} from 'expo-router/tabs';
import {Text} from 'react-native';
import {GOLD, useActiveTheme} from '../../components/ui/theme.ts';

const ICONS: Readonly<Record<string, string>> = {
  index: '⌂',
  play: '▶',
  collection: '❖',
  friends: '☺',
  profile: '♔',
};

export default function TabsLayout() {
  const theme = useActiveTheme();
  return (
    <Tabs
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: theme.palette.textMuted,
        tabBarStyle: {
          backgroundColor: theme.palette.surface,
          borderTopColor: theme.palette.surfaceAlt,
        },
        tabBarIcon: ({color}) => (
          <Text style={{color, fontSize: 20}}>{ICONS[route.name] ?? '•'}</Text>
        ),
      })}>
      <Tabs.Screen name="index" options={{title: 'Accueil'}} />
      <Tabs.Screen name="play" options={{title: 'Jouer'}} />
      <Tabs.Screen name="collection" options={{title: 'Collection'}} />
      <Tabs.Screen name="friends" options={{title: 'Amis'}} />
      <Tabs.Screen name="profile" options={{title: 'Profil'}} />
    </Tabs>
  );
}
