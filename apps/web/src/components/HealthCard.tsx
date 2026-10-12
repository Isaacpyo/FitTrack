import { formatDateKey } from '@fittrack/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getHealthProvider, type HealthProvider } from '../health';
import { syncHealthData } from '../health/sync';
import { formatNumber } from '../lib/format';
import { useAppDispatch, useAppSelector, useToday } from '../store/hooks';
import { selectStepGoal } from '../store/selectors';
import { space } from '../theme';
import { Body, Button, Caption, Card, ProgressBar, Row } from './ui';

export function useHealthProvider(): HealthProvider | null {
  const [provider, setProvider] = useState<HealthProvider | null>(null);
  useEffect(() => {
    let alive = true;
    void getHealthProvider().then((p) => alive && setProvider(p));
    return () => {
      alive = false;
    };
  }, []);
  return provider;
}

/** Today's steps vs goal, plus the connect / sync action for the active health source. */
export function HealthCard() {
  const dispatch = useAppDispatch();
  const provider = useHealthProvider();
  const today = useToday();
  const goal = useAppSelector(selectStepGoal);
  const todayActivity = useAppSelector((s) => s.activity.byDate[today]);
  const { healthConnected, healthSyncing, healthError } = useAppSelector((s) => s.activity);
  const steps = todayActivity?.steps ?? 0;
  const needsConnect = provider !== null && !provider.isMock && !healthConnected;

  return (
    <Card testID="health-card">
      <Row style={{ justifyContent: 'space-between' }}>
        <Caption>Steps today</Caption>
        <Caption>{formatDateKey(today)}</Caption>
      </Row>
      <Body
        style={{ fontSize: 26, fontWeight: '800' }}
        accessibilityLabel={`${formatNumber(steps)} of ${formatNumber(goal)} steps`}
      >
        {formatNumber(steps)}
        <Body muted style={{ fontSize: 16 }}>{` / ${formatNumber(goal)}`}</Body>
      </Body>
      <ProgressBar value={steps} max={goal} label="Daily step goal progress" />
      <View style={{ gap: space.xs }}>
        <Body muted style={{ fontSize: 13 }}>
          {provider
            ? provider.isMock
              ? 'Simulated data — Apple Health and Health Connect sync in the iOS/Android development builds.'
              : `Source: ${provider.label}${todayActivity ? ` · ${formatNumber(todayActivity.activeMinutes)} active min` : ''}`
            : 'Checking for health data…'}
        </Body>
        {healthError ? <Body style={{ fontSize: 13, color: '#F87171' }}>{healthError}</Body> : null}
      </View>
      {provider ? (
        <Button
          compact
          variant="secondary"
          icon={needsConnect ? 'link-outline' : 'refresh'}
          label={needsConnect ? `Connect ${provider.label}` : 'Sync health data'}
          loading={healthSyncing}
          onPress={() =>
            void dispatch(
              syncHealthData(provider, { requestPermission: needsConnect || !provider.isMock }),
            )
          }
        />
      ) : null}
    </Card>
  );
}
