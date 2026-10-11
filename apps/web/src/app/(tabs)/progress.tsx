import {
  addDays,
  dateRange,
  EXERCISES_BY_ID,
  exerciseName,
  exerciseProgress,
  formatDateKey,
  formatShortDate,
  RECORD_LABELS,
  recordKindsFor,
  weeklyVolume,
} from '@fittrack/shared';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart } from '../../components/charts/BarChart';
import type { ChartDatum } from '../../components/charts/ChartShell';
import { LineChart } from '../../components/charts/LineChart';
import { Screen } from '../../components/Screen';
import {
  Body,
  Caption,
  Card,
  Chip,
  EmptyState,
  Grid,
  Heading,
  Row,
  Stat,
  Title,
} from '../../components/ui';
import { formatKg, formatNumber, formatVolume } from '../../lib/format';
import { useAppSelector, useToday } from '../../store/hooks';
import {
  selectActivity,
  selectExerciseUsage,
  selectRecordAnalysis,
  selectStepGoal,
  selectWorkouts,
} from '../../store/selectors';
import { space } from '../../theme';

const MAX_POINTS = 20;

export default function Progress() {
  const today = useToday();
  const workouts = useAppSelector(selectWorkouts);
  const usage = useAppSelector(selectExerciseUsage);
  const { records } = useAppSelector(selectRecordAnalysis);
  const activity = useAppSelector(selectActivity);
  const stepGoal = useAppSelector(selectStepGoal);
  const [picked, setPicked] = useState<string | null>(null);

  const exerciseId = picked ?? usage[0]?.exerciseId ?? null;
  const bodyweight = exerciseId ? Boolean(EXERCISES_BY_ID.get(exerciseId)?.bodyweight) : false;

  const progressData: ChartDatum[] = useMemo(() => {
    if (!exerciseId) return [];
    return exerciseProgress(workouts, exerciseId)
      .slice(-MAX_POINTS)
      .map((p) => {
        const value = bodyweight ? p.bestReps : (p.bestE1rm ?? p.topWeightKg);
        return {
          key: p.workoutId,
          label: formatShortDate(p.date),
          value,
          display: bodyweight ? `${value} reps` : formatKg(value),
          description: formatDateKey(p.date),
        };
      });
  }, [workouts, exerciseId, bodyweight]);

  const volumeData: ChartDatum[] = useMemo(
    () =>
      weeklyVolume(workouts, today, 12).map((w) => ({
        key: w.weekStart,
        label: formatShortDate(w.weekStart),
        value: w.volumeKg,
        display: formatVolume(w.volumeKg),
        description: `Week of ${formatShortDate(w.weekStart)} · ${w.workouts} workout${w.workouts === 1 ? '' : 's'}`,
      })),
    [workouts, today],
  );

  const stepsData: ChartDatum[] = useMemo(() => {
    const byDate = new Map(activity.map((a) => [a.date, a]));
    return dateRange(addDays(today, -13), today).map((d) => {
      const steps = byDate.get(d)?.steps ?? 0;
      return {
        key: d,
        label: formatShortDate(d),
        value: steps,
        display: `${formatNumber(steps)} steps`,
        description: formatDateKey(d),
      };
    });
  }, [activity, today]);

  const exerciseRecords = exerciseId ? records.get(exerciseId) : undefined;
  const allRecords = [...records.values()].sort((a, b) =>
    b.lastPerformed.localeCompare(a.lastPerformed),
  );

  if (workouts.length === 0 && activity.length === 0) {
    return (
      <Screen testID="progress-screen">
        <Title>Progress</Title>
        <EmptyState
          icon="stats-chart-outline"
          title="Nothing to chart yet"
          body="Log a few workouts and your strength curve, weekly volume and records will appear here."
        />
      </Screen>
    );
  }

  const first = progressData[0];
  const last = progressData[progressData.length - 1];

  return (
    <Screen testID="progress-screen">
      <Title>Progress</Title>

      {usage.length > 0 && exerciseId ? (
        <Card>
          <Heading>{exerciseName(exerciseId)}</Heading>
          <Body muted style={{ fontSize: 14 }}>
            {bodyweight
              ? 'Best set (reps) per session'
              : 'Estimated one-rep max per session (Epley)'}
          </Body>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
            accessibilityRole="tablist"
            accessibilityLabel="Choose exercise"
          >
            {usage.slice(0, 8).map((u) => (
              <Chip
                key={u.exerciseId}
                label={exerciseName(u.exerciseId)}
                selected={u.exerciseId === exerciseId}
                onPress={() => setPicked(u.exerciseId)}
              />
            ))}
          </View>
          {progressData.length > 0 && first && last ? (
            <LineChart
              data={progressData}
              valueHeader={bodyweight ? 'Best reps' : 'Est. 1RM'}
              summary={`${exerciseName(exerciseId)}: ${bodyweight ? 'best reps' : 'estimated one-rep max'} over ${progressData.length} sessions, from ${first.display} on ${first.description} to ${last.display} on ${last.description}.`}
              testID="exercise-chart"
            />
          ) : null}
          {exerciseRecords ? (
            <Grid min={130}>
              {recordKindsFor(exerciseId)
                .filter((k) => exerciseRecords.records[k])
                .map((k) => {
                  const r = exerciseRecords.records[k]!;
                  return (
                    <Stat
                      key={k}
                      label={RECORD_LABELS[k]}
                      value={k === 'reps' ? `${r.value}` : formatKg(r.value)}
                      sub={`${k === 'reps' ? '' : `${r.reps} × ${formatKg(r.weightKg)} · `}${formatShortDate(r.date)}`}
                    />
                  );
                })}
              <Stat
                label="Sessions"
                value={String(exerciseRecords.sessions)}
                sub={`Last: ${formatShortDate(exerciseRecords.lastPerformed)}`}
              />
            </Grid>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Heading>Weekly volume</Heading>
        <Body muted style={{ fontSize: 14 }}>
          Total weight × reps per week, last 12 weeks
        </Body>
        <BarChart
          data={volumeData}
          valueHeader="Volume"
          summary={`Weekly training volume for the last 12 weeks. This week: ${volumeData.at(-1)?.display ?? '0 kg'}.`}
          testID="volume-chart"
        />
      </Card>

      <Card>
        <Heading>Daily steps</Heading>
        <Body muted style={{ fontSize: 14 }}>
          Last 14 days against your {formatNumber(stepGoal)}-step goal
        </Body>
        <BarChart
          data={stepsData}
          valueHeader="Steps"
          reference={{ value: stepGoal, label: `Goal ${formatNumber(stepGoal)}` }}
          summary={`Daily steps for the last 14 days. Goal met on ${stepsData.filter((d) => d.value >= stepGoal).length} of 14 days.`}
          testID="steps-chart"
        />
      </Card>

      {allRecords.length ? (
        <Card testID="records-table">
          <Heading>Personal records</Heading>
          {allRecords.map((r) => {
            const main = r.records.e1rm ?? r.records.weight ?? r.records.reps;
            const kind = r.records.e1rm ? 'e1rm' : r.records.weight ? 'weight' : 'reps';
            return (
              <Row
                key={r.exerciseId}
                style={{ justifyContent: 'space-between', paddingVertical: 4 }}
              >
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{exerciseName(r.exerciseId)}</Body>
                  <Caption>{RECORD_LABELS[kind]}</Caption>
                </View>
                <Body style={{ fontWeight: '700' }}>
                  {main ? (kind === 'reps' ? `${main.value} reps` : formatKg(main.value)) : '—'}
                </Body>
              </Row>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
