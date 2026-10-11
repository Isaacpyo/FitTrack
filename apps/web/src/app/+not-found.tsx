import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <Screen width="form">
      <EmptyState
        icon="compass-outline"
        title="Page not found"
        body="That page doesn’t exist. It may have been moved or deleted."
        action={<Button label="Go home" icon="home-outline" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
