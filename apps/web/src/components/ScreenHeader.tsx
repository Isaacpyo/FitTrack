import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space } from '../theme';
import { IconButton, Title } from './ui';

/** Title row with a back button that also works for deep links (no history on the web). */
export function ScreenHeader({
  title,
  fallback,
  actions,
}: {
  title: string;
  fallback: Href;
  actions?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <IconButton
        icon="chevron-back"
        label="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      />
      <View style={{ flex: 1 }}>
        <Title>{title}</Title>
      </View>
      {actions}
    </View>
  );
}
