import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from '../state/auth.tsx';
import {LocalStatsProvider} from '../state/localStats.tsx';
import {ProfileProvider} from '../state/profile.tsx';
import {SettingsProvider} from '../state/settings.tsx';
import {useActiveTheme} from '../components/ui/theme.ts';

function ThemedStack() {
  const theme = useActiveTheme();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {backgroundColor: theme.palette.surface},
          headerTintColor: theme.palette.text,
          contentStyle: {backgroundColor: theme.palette.background},
        }}>
        <Stack.Screen name="(tabs)" options={{headerShown: false}} />
        <Stack.Screen
          name="game"
          options={{headerShown: false, gestureEnabled: false}}
        />
        <Stack.Screen name="shop" options={{title: 'Boutique'}} />
        <Stack.Screen name="chest" options={{title: 'Coffre'}} />
        <Stack.Screen name="missions" options={{title: 'Missions et succès'}} />
        <Stack.Screen name="rankings" options={{title: 'Classements'}} />
        <Stack.Screen name="settings" options={{title: 'Paramètres'}} />
        <Stack.Screen name="account" options={{title: 'Compte'}} />
        <Stack.Screen name="online" options={{title: 'En ligne'}} />
        <Stack.Screen
          name="online-game"
          options={{headerShown: false, gestureEnabled: false}}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <ProfileProvider>
            <LocalStatsProvider>
              <ThemedStack />
            </LocalStatsProvider>
          </ProfileProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
