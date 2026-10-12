import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useDemoSignIn } from '../components/useSignIn';
import { Banner, Body, Button, Card, Grid, type IconName } from '../components/ui';
import { describeApiError } from '../store/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { expiredNoticeDismissed } from '../store/sessionSlice';
import { colors, space } from '../theme';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'barbell-outline',
    title: 'Log every set',
    body: 'Sets, reps and weight in seconds, prefilled from last time.',
  },
  {
    icon: 'trophy-outline',
    title: 'Personal records',
    body: 'Heaviest lift, estimated 1RM and best volume, tracked for you.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Progress & streaks',
    body: 'Charts per exercise, weekly volume and a streak to protect.',
  },
  {
    icon: 'cloud-offline-outline',
    title: 'Works offline',
    body: 'Log in the basement gym; it syncs when you’re back online.',
  },
];

export default function Welcome() {
  const demo = useDemoSignIn();
  const dispatch = useAppDispatch();
  const expired = useAppSelector((s) => s.session.expired);
  const pending = useAppSelector((s) => s.outbox.items.length);

  return (
    <Screen width="form" testID="welcome-screen">
      {expired ? (
        <Banner
          tone="warning"
          icon="time-outline"
          action={
            <Button
              compact
              variant="ghost"
              label="Dismiss"
              onPress={() => dispatch(expiredNoticeDismissed())}
            />
          }
        >
          <Body>
            Your session expired. Sign in again
            {pending ? ` to sync ${pending} saved change${pending === 1 ? '' : 's'}` : ''}.
          </Body>
        </Banner>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="flame" size={36} color={colors.accentText} />
        </View>
        <Text style={styles.brand} accessibilityRole="header">
          FitTrack
        </Text>
        <Body muted style={styles.tagline}>
          Track progress. Build habits. Beat your PRs — even with no signal.
        </Body>
      </View>

      <Card style={{ gap: space.md }}>
        <Button
          label="Try the demo"
          icon="play"
          onPress={demo.start}
          loading={demo.isLoading}
          accessibilityHint="Signs you into a private demo account with ten weeks of sample training"
          testID="try-demo"
        />
        {demo.isLoading ? (
          <Body muted style={styles.center}>
            Setting up your demo account…
          </Body>
        ) : null}
        {demo.error ? (
          <Body style={[styles.center, { color: colors.danger }]}>
            {describeApiError(demo.error)}
          </Body>
        ) : null}
        <View style={styles.row}>
          <Button
            label="Create account"
            variant="secondary"
            style={styles.flex}
            onPress={() => router.push('/signup')}
          />
          <Button
            label="Sign in"
            variant="secondary"
            style={styles.flex}
            onPress={() => router.push('/login')}
          />
        </View>
        <Body muted style={[styles.center, { fontSize: 13 }]}>
          The demo is a private sandbox with sample data. It is deleted after 24 hours.
        </Body>
      </Card>

      <Grid min={220}>
        {FEATURES.map((f) => (
          <Card key={f.title} style={{ gap: space.xs }}>
            <Ionicons name={f.icon} size={22} color={colors.accent} />
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Body muted style={{ fontSize: 14 }}>
              {f.body}
            </Body>
          </Card>
        ))}
      </Grid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 44,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.5,
    color: colors.text,
  },
  tagline: { textAlign: 'center', maxWidth: 360 },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  flex: { flexGrow: 1, flexBasis: 140 },
  center: { textAlign: 'center' },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
