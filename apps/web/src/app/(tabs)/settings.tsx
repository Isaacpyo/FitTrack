import { profileUpdateSchema } from '@fittrack/shared';
import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';
import { fieldErrorsFrom } from '../../components/AuthForm';
import { useHealthProvider } from '../../components/HealthCard';
import { Screen } from '../../components/Screen';
import { Badge, Banner, Body, Button, Caption, Card, Heading, Row, TextField, Title } from '../../components/ui';
import { API_URL } from '../../config';
import { syncHealthData } from '../../health/sync';
import { confirm } from '../../lib/confirm';
import { describeApiError, useDeleteAccountMutation, useUpdateProfileMutation } from '../../store/api';
import { flushRequested, pullRequested, signedOut } from '../../store/actions';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { failedDiscarded, failedRetried } from '../../store/outboxSlice';
import { selectPendingCount, selectUser } from '../../store/selectors';
import { signOut } from '../../store/thunks';
import { colors, space } from '../../theme';

const OP_LABELS: Record<string, string> = {
  'workout.upsert': 'Save workout',
  'workout.delete': 'Delete workout',
  'routine.upsert': 'Save routine',
  'routine.delete': 'Delete routine',
  'activity.upsert': 'Upload health data',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function ProfileCard() {
  const user = useAppSelector(selectUser);
  const online = useAppSelector((s) => s.sync.online);
  const [update, { isLoading, error, isSuccess, reset }] = useUpdateProfileMutation();
  const [form, setForm] = useState({
    displayName: user?.displayName ?? '',
    stepGoal: String(user?.stepGoal ?? 8000),
    weeklyWorkoutGoal: String(user?.weeklyWorkoutGoal ?? 3),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    reset();
    const parsed = profileUpdateSchema.safeParse({
      displayName: form.displayName,
      stepGoal: Number(form.stepGoal),
      weeklyWorkoutGoal: Number(form.weeklyWorkoutGoal),
    });
    if (!parsed.success) return setErrors(fieldErrorsFrom(parsed.error.issues));
    setErrors({});
    await update(parsed.data);
  };

  const set = (key: keyof typeof form) => (value: string) => {
    reset();
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <Card style={{ gap: space.md }}>
      <Heading>Profile & goals</Heading>
      <TextField label="Name" value={form.displayName} onChangeText={set('displayName')} error={errors.displayName} autoComplete="name" />
      <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
        <TextField
          style={{ flexGrow: 1, flexBasis: 140 }}
          label="Daily step goal"
          value={form.stepGoal}
          onChangeText={set('stepGoal')}
          keyboardType="number-pad"
          error={errors.stepGoal ? 'Between 1,000 and 100,000' : undefined}
        />
        <TextField
          style={{ flexGrow: 1, flexBasis: 140 }}
          label="Workouts per week"
          value={form.weeklyWorkoutGoal}
          onChangeText={set('weeklyWorkoutGoal')}
          keyboardType="number-pad"
          error={errors.weeklyWorkoutGoal ? 'Between 1 and 14' : undefined}
        />
      </View>
      {error ? <Body style={{ color: colors.danger }}>{describeApiError(error)}</Body> : null}
      {isSuccess ? <Body style={{ color: colors.success }}>Saved.</Body> : null}
      <Button
        label={online ? 'Save profile' : 'Connect to save profile'}
        onPress={save}
        loading={isLoading}
        disabled={!online}
        accessibilityHint="Profile changes need a connection; workouts can be logged offline"
      />
    </Card>
  );
}

function HealthSettings() {
  const dispatch = useAppDispatch();
  const provider = useHealthProvider();
  const { healthConnected, healthSyncing, healthError, lastHealthSyncAt } = useAppSelector((s) => s.activity);
  return (
    <Card style={{ gap: space.md }}>
      <Heading>Health data</Heading>
      <Row>
        <Body>Source: {provider?.label ?? '…'}</Body>
        {provider?.isMock ? <Badge tone="info" label="Simulated" /> : healthConnected ? <Badge tone="success" label="Connected" /> : null}
      </Row>
      <Body muted style={{ fontSize: 14 }}>
        {provider?.isMock
          ? 'Browsers and Expo Go can’t read Apple Health or Health Connect, so this build uses realistic simulated steps. Install the iOS or Android development build to sync real data.'
          : 'FitTrack reads steps, active energy and exercise minutes for the last 30 days. Nothing is written back.'}
      </Body>
      <Body muted style={{ fontSize: 14 }}>Last synced {timeAgo(lastHealthSyncAt)}</Body>
      {healthError ? <Body style={{ color: colors.danger }}>{healthError}</Body> : null}
      {provider ? (
        <Button
          variant="secondary"
          icon="refresh"
          label={!provider.isMock && !healthConnected ? `Connect ${provider.label}` : 'Sync now'}
          loading={healthSyncing}
          onPress={() => void dispatch(syncHealthData(provider, { requestPermission: !provider.isMock }))}
        />
      ) : null}
    </Card>
  );
}

function SyncSettings() {
  const dispatch = useAppDispatch();
  const { online, lastPulledAt, lastError, flushing, pulling } = useAppSelector((s) => s.sync);
  const pending = useAppSelector(selectPendingCount);
  const failed = useAppSelector((s) => s.outbox.failed);
  return (
    <Card style={{ gap: space.md }} testID="sync-settings">
      <Heading>Sync</Heading>
      <Body>
        {online ? 'Online' : 'Offline'} · {pending} change{pending === 1 ? '' : 's'} waiting · last synced {timeAgo(lastPulledAt)}
      </Body>
      {lastError && pending > 0 ? <Body style={{ color: colors.warning, fontSize: 14 }}>Last attempt: {lastError} Retrying automatically.</Body> : null}
      <Button
        variant="secondary"
        icon="sync"
        label="Sync now"
        loading={flushing || pulling}
        disabled={!online}
        onPress={() => {
          dispatch(flushRequested());
          dispatch(pullRequested());
        }}
      />
      {failed.length ? (
        <Banner tone="danger" icon="alert-circle-outline">
          <Body style={{ fontWeight: '700' }}>
            {failed.length} change{failed.length === 1 ? '' : 's'} rejected by the server
          </Body>
          {failed.map((f) => (
            <View key={f.id} style={{ gap: 4, marginTop: space.sm }}>
              <Body style={{ fontSize: 14 }}>
                {OP_LABELS[f.kind]}: {f.lastError}
              </Body>
              <Row>
                <Button compact variant="secondary" label="Retry" onPress={() => dispatch(failedRetried(f.id))} />
                <Button compact variant="ghost" label="Discard" onPress={() => dispatch(failedDiscarded(f.id))} />
              </Row>
            </View>
          ))}
        </Banner>
      ) : null}
    </Card>
  );
}

function AccountSettings() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const pending = useAppSelector(selectPendingCount);
  const online = useAppSelector((s) => s.sync.online);
  const [deleteAccount, { isLoading, error }] = useDeleteAccountMutation();

  const doSignOut = async () => {
    const warning = pending
      ? `${pending} change${pending === 1 ? ' has' : 's have'} not synced yet and will be lost.`
      : 'You can sign back in at any time.';
    if (await confirm('Sign out?', warning, 'Sign out', pending > 0)) dispatch(signOut());
  };

  const doDelete = async () => {
    if (!(await confirm('Delete account?', 'This permanently deletes your account and all workouts, routines and health data.', 'Delete', true))) return;
    const result = await deleteAccount();
    if (!('error' in result)) dispatch(signedOut({ reason: 'user' }));
  };

  return (
    <Card style={{ gap: space.md }}>
      <Heading>Account</Heading>
      <Row style={{ flexWrap: 'wrap' }}>
        <Body>{user?.email}</Body>
        {user?.isDemo ? <Badge tone="info" label="Demo account · deleted after 24 h" /> : null}
      </Row>
      <Button variant="secondary" icon="log-out-outline" label="Sign out" onPress={doSignOut} testID="sign-out" />
      {error ? <Body style={{ color: colors.danger }}>{describeApiError(error)}</Body> : null}
      <Button variant="danger" icon="trash-outline" label="Delete account" onPress={doDelete} loading={isLoading} disabled={!online} />
    </Card>
  );
}

export default function Settings() {
  return (
    <Screen width="form" testID="settings-screen">
      <Title>Settings</Title>
      <ProfileCard />
      <HealthSettings />
      <SyncSettings />
      <AccountSettings />
      <View style={{ gap: 2 }}>
        <Caption>About</Caption>
        <Body muted style={{ fontSize: 13 }}>
          FitTrack {Constants.expoConfig?.version ?? ''} · API {API_URL}
        </Body>
      </View>
    </Screen>
  );
}
