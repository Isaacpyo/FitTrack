import {
  exerciseName,
  formatDateKey,
  periodSummary,
  RECORD_LABELS,
  startOfWeek,
} from '@fittrack/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { HealthCard } from '../../components/HealthCard';
import { Screen } from '../../components/Screen';
import { SyncStatusChip } from '../../components/SyncStatus';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  ErrorState,
  Grid,
  Heading,
  LoadingState,
  Row,
  Stat,
  Title,
} from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { formatKg, formatVolume, greeting, relativeDay } from '../../lib/format';
import { newWorkoutHref } from '../../lib/routes';
import { pullRequested } from '../../store/actions';
import { draftDiscarded } from '../../store/draftSlice';
import { useAppDispatch, useAppSelector, useToday } from '../../store/hooks';
import {
  selectRecentRecords,
  selectRoutines,
  selectStreaks,
  selectUser,
  selectWeeklyGoal,
  selectWorkouts,
} from '../../store/selectors';
import { space } from '../../theme';

export default function Today() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const user = useAppSelector(selectUser);
  const workouts = useAppSelector(selectWorkouts);
  const routines = useAppSelector(selectRoutines);
  const draft = useAppSelector((s) => s.draft.current);
  const streaks = useAppSelector((s) => selectStreaks(s, today));
  const weeklyGoal = useAppSelector(selectWeeklyGoal);
  const recentRecords = useAppSelector(selectRecentRecords);
  const firstSync = useAppSelector((s) => s.sync.lastPulledAt === null);
  const pulling = useAppSelector((s) => s.sync.pulling);
  const syncError = useAppSelector((s) => s.sync.lastError);

  const week = periodSummary(workouts, startOfWeek(today), today);
  const loadingHistory = firstSync && workouts.length === 0 && (pulling || !syncError);

  const start = async (routineId?: string) => {
    if (draft?.isNew) {
      const ok = await confirm(
        'Replace workout in progress?',
        `“${draft.name}” hasn’t been saved yet. Starting a new workout discards it.`,
        'Start new',
        true,
      );
      if (!ok) return;
    }
    router.push(newWorkoutHref(routineId));
  };

  return (
    <Screen testID="today-screen">
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Caption>{formatDateKey(today)}</Caption>
          <Title>
            {greeting(new Date())}
            {user ? `, ${user.displayName.split(' ')[0]}` : ''}
          </Title>
        </View>
        <SyncStatusChip />
      </Row>

      {draft?.isNew ? (
        <Card testID="draft-card">
          <Caption>Workout in progress</Caption>
          <Body style={{ fontWeight: '700' }}>{draft.name}</Body>
          <Body muted style={{ fontSize: 14 }}>
            {draft.exercises.length} exercise{draft.exercises.length === 1 ? '' : 's'} · not saved
            yet
          </Body>
          <Row>
            <Button
              compact
              label="Resume"
              icon="play"
              onPress={() => router.push('/workout/new')}
            />
            <Button
              compact
              variant="ghost"
              label="Discard"
              onPress={() => dispatch(draftDiscarded())}
            />
          </Row>
        </Card>
      ) : null}

      {loadingHistory ? <LoadingState label="Loading your training history…" /> : null}
      {firstSync && !pulling && syncError && workouts.length === 0 ? (
        <ErrorState
          message={`Couldn’t load your history. ${syncError}`}
          onRetry={() => dispatch(pullRequested())}
        />
      ) : null}

      <Grid min={160}>
        <Stat
          icon="flame"
          label="Day streak"
          value={`${streaks.day.current} day${streaks.day.current === 1 ? '' : 's'}`}
          sub={
            streaks.day.activeToday
              ? `Active today · best ${streaks.day.longest}`
              : 'Train or hit your step goal today'
          }
          testID="day-streak"
        />
        <Stat
          icon="calendar"
          label="Weekly goal"
          value={`${streaks.week.thisWeekCount}/${weeklyGoal}`}
          sub={`${streaks.week.current}-week streak · best ${streaks.week.longest}`}
          testID="week-streak"
        />
        <Stat
          icon="barbell"
          label="This week"
          value={formatVolume(week.volumeKg)}
          sub={`${week.workouts} workout${week.workouts === 1 ? '' : 's'} · ${week.sets} sets`}
          testID="week-volume"
        />
      </Grid>

      <Heading>Start a workout</Heading>
      <Card style={{ gap: space.md }}>
        <Button
          label="Start empty workout"
          icon="add"
          onPress={() => void start()}
          testID="start-empty"
        />
        {routines.map((r) => (
          <Row key={r.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{r.name}</Body>
              <Body muted style={{ fontSize: 13 }} numberOfLines={1}>
                {r.exercises.map((e) => exerciseName(e.exerciseId)).join(', ')}
              </Body>
            </View>
            <Button
              compact
              variant="secondary"
              label="Start"
              accessibilityLabel={`Start ${r.name}`}
              onPress={() => void start(r.id)}
            />
          </Row>
        ))}
        {routines.length === 0 ? (
          <Button
            compact
            variant="ghost"
            icon="list-outline"
            label="Create a reusable routine"
            onPress={() => router.push('/routine/new')}
          />
        ) : null}
      </Card>

      <HealthCard />

      <Heading>Recent personal records</Heading>
      {recentRecords.length ? (
        <Card testID="recent-prs">
          {recentRecords.map((e) => (
            <Row
              key={`${e.workoutId}-${e.exerciseId}-${e.kind}`}
              style={{ justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>{exerciseName(e.exerciseId)}</Body>
                <Body muted style={{ fontSize: 13 }}>
                  {RECORD_LABELS[e.kind]} · {relativeDay(e.date, today)}
                </Body>
              </View>
              <Body style={{ fontWeight: '700' }}>
                {e.kind === 'reps' ? `${e.value} reps` : formatKg(e.value)}
              </Body>
            </Row>
          ))}
        </Card>
      ) : workouts.length === 0 && !loadingHistory ? (
        <EmptyState
          icon="barbell-outline"
          title="Log your first workout"
          body="Start an empty workout or build a routine. Your PRs, streaks and charts appear as you train."
        />
      ) : (
        <Body muted>Keep training — beat a previous best and it shows up here.</Body>
      )}
    </Screen>
  );
}
