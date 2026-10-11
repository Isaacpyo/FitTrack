import { router } from 'expo-router';
import { useAppSelector } from '../store/hooks';
import { selectFailedCount, selectPendingCount } from '../store/selectors';
import { Badge } from './ui';
import { Pressable } from 'react-native';

/** Compact sync indicator; opens Settings for details. */
export function SyncStatusChip() {
  const online = useAppSelector((s) => s.sync.online);
  const busy = useAppSelector((s) => s.sync.flushing || s.sync.pulling);
  const pending = useAppSelector(selectPendingCount);
  const failed = useAppSelector(selectFailedCount);

  const badge = failed
    ? <Badge tone="danger" icon="alert-circle" label={`${failed} failed`} />
    : !online
      ? <Badge tone="warning" icon="cloud-offline" label={pending ? `Offline · ${pending} pending` : 'Offline'} />
      : pending
        ? <Badge tone="info" icon="cloud-upload" label={busy ? `Syncing ${pending}…` : `${pending} pending`} />
        : busy
          ? <Badge tone="info" icon="sync" label="Syncing…" />
          : <Badge tone="success" icon="cloud-done" label="Synced" />;

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Sync status, open settings"
      testID="sync-status"
      hitSlop={8}
    >
      {badge}
    </Pressable>
  );
}
