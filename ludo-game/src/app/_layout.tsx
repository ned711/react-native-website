import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {LocalStatsProvider} from '../state/localStats.tsx';
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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <LocalStatsProvider>
          <ThemedStack />
        </LocalStatsProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
