import { Text, View } from 'react-native';
import { selectPendingCount } from '../store/selectors';
import { useAppSelector } from '../store/hooks';
import { colors, maxWidth, space } from '../theme';
import { Banner, Body } from './ui';

/** App-wide connection status: offline queueing and the free-tier cold start. */
export function GlobalBanners() {
  const online = useAppSelector((s) => s.sync.online);
  const waking = useAppSelector((s) => s.sync.serverWaking);
  const pending = useAppSelector(selectPendingCount);
  if (online && !waking) return null;

  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: maxWidth.page }}>
        {!online ? (
          <Banner tone="warning" icon="cloud-offline-outline" testID="offline-banner">
            <Text style={{ color: colors.text, fontWeight: '700' }}>You’re offline</Text>
            <Body muted style={{ fontSize: 14 }}>
              Everything you log is saved on this device
              {pending > 0 ? ` (${pending} change${pending === 1 ? '' : 's'} waiting)` : ''} and
              syncs when you reconnect.
            </Body>
          </Banner>
        ) : (
          <Banner tone="info" icon="cloud-outline" busy testID="waking-banner">
            <Text style={{ color: colors.text, fontWeight: '700' }}>Waking the server…</Text>
            <Body muted style={{ fontSize: 14 }}>
              The free-tier API sleeps when idle, so the first request can take up to a minute.
            </Body>
          </Banner>
        )}
      </View>
    </View>
  );
}
