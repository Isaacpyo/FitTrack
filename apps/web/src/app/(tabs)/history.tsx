import {
  addDays,
  exerciseName,
  formatShortDate,
  RECORD_LABELS,
  startOfWeek,
  toDateKey,
  workoutVolume,
  type Workout,
} from '@fittrack/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { SyncStatusChip } from '../../components/SyncStatus';
import { WorkoutCard } from '../../components/WorkoutCard';
import { Banner, Body, Button, Caption, EmptyState, IconButton, Row, Title } from '../../components/ui';
import { formatKg, formatVolume } from '../../lib/format';
import { newWorkoutHref } from '../../lib/routes';
import { useAppSelector, useToday } from '../../store/hooks';
import { selectPendingKeys, selectRecordEventsByWorkout, selectWorkouts } from '../../store/selectors';
import { colors, space } from '../../theme';

const PAGE = 30;

function weekTitle(weekStart: string, today: string): string {
  const current = startOfWeek(today);
  if (weekStart === current) return 'This week';
  if (weekStart === addDays(current, -7)) return 'Last week';
  return `Week of ${formatShortDate(weekStart)}`;
}

export default function History() {
  const today = useToday();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const [dismissed, setDismissed] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const workouts = useAppSelector(selectWorkouts);
  const recordsByWorkout = useAppSelector(selectRecordEventsByWorkout);
  const pending = useAppSelector(selectPendingKeys);
  const online = useAppSelector((s) => s.sync.online);

  const weeks = useMemo(() => {
    const groups = new Map<string, Workout[]>();
    for (const w of workouts.slice(0, limit)) {
      const key = startOfWeek(toDateKey(w.startedAt));
      groups.set(key, [...(groups.get(key) ?? []), w]);
    }
    return [...groups.entries()];
  }, [workouts, limit]);

  const savedWorkout = saved ? workouts.find((w) => w.id === saved) : undefined;
  const savedRecords = saved ? (recordsByWorkout.get(saved) ?? []) : [];
  const savedPending = saved ? pending.has(`workout:${saved}`) : false;

  return (
    <Screen testID="history-screen">
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>History</Title>
        <SyncStatusChip />
      </Row>

      {savedWorkout && !dismissed ? (
        <Banner
          tone="success"
          icon="checkmark-circle"
          testID="saved-banner"
          action={<IconButton icon="close" label="Dismiss" onPress={() => setDismissed(true)} />}
        >
          <Body style={{ fontWeight: '700' }}>Workout saved</Body>
          <Body muted style={{ fontSize: 14 }}>
            {savedPending
              ? online
                ? 'Uploading…'
                : 'Saved on this device. It will sync when you’re back online.'
              : 'Synced to your account.'}
          </Body>
          {savedRecords.map((r) => (
            <Body key={`${r.exerciseId}-${r.kind}`} style={{ fontSize: 14, color: colors.text }}>
              🏆 {exerciseName(r.exerciseId)}: {RECORD_LABELS[r.kind]} {r.kind === 'reps' ? `${r.value} reps` : formatKg(r.value)} (was{' '}
              {r.kind === 'reps' ? r.previous : formatKg(r.previous)})
            </Body>
          ))}
        </Banner>
      ) : null}

      {workouts.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No workouts yet"
          body="Workouts you log appear here, grouped by week, with your PRs highlighted."
          action={<Button label="Log a workout" icon="add" onPress={() => router.push(newWorkoutHref())} />}
        />
      ) : (
        weeks.map(([weekStart, list]) => (
          <View key={weekStart} style={{ gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Caption>{weekTitle(weekStart, today)}</Caption>
              <Caption>
                {list.length} workout{list.length === 1 ? '' : 's'} · {formatVolume(list.reduce((n, w) => n + workoutVolume(w), 0))}
              </Caption>
            </Row>
            {list.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                today={today}
                records={recordsByWorkout.get(w.id)}
                pending={pending.has(`workout:${w.id}`)}
              />
            ))}
          </View>
        ))
      )}
      {workouts.length > limit ? (
        <Button variant="secondary" label={`Show older workouts (${workouts.length - limit} more)`} onPress={() => setLimit((l) => l + PAGE)} />
      ) : null}
    </Screen>
  );
}
