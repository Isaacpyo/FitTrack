import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppEffects } from '../components/AppEffects';
import { appStorage } from '../lib/appStorage';
import { tokenStorage } from '../lib/tokenStorage';
import { createAppStore, type AppStore } from '../store';
import { useAppSelector } from '../store/hooks';
import { selectIsSignedIn } from '../store/selectors';
import { colors } from '../theme';

function RootStack() {
  const signedIn = useAppSelector(selectIsSignedIn);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="routine/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
    </Stack>
  );
}

function Boot({ error }: { error: string | null }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>FitTrack</Text>
      {error ? (
        <Text style={{ color: colors.danger, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading FitTrack" />
      )}
    </View>
  );
}

export default function RootLayout() {
  const [store, setStore] = useState<AppStore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createAppStore({ storage: appStorage, tokenStorage, now: () => new Date() }).then(setStore, (err: unknown) =>
      setError(`Could not start FitTrack: ${err instanceof Error ? err.message : String(err)}`),
    );
  }, []);

  if (!store) return <Boot error={error} />;
  return (
    <Provider store={store}>
      <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <AppEffects />
        <RootStack />
      </SafeAreaProvider>
    </Provider>
  );
}
