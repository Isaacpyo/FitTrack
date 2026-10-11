import { exerciseName } from '@fittrack/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, EmptyState, Row, Title } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { formatKg } from '../../lib/format';
import { newWorkoutHref } from '../../lib/routes';
import { useAppSelector } from '../../store/hooks';
import { selectRoutines } from '../../store/selectors';
import { space } from '../../theme';

export default function Routines() {
  const routines = useAppSelector(selectRoutines);
  const draft = useAppSelector((s) => s.draft.current);

  const start = async (routineId: string) => {
    if (draft?.isNew && !(await confirm('Replace workout in progress?', `“${draft.name}” hasn’t been saved yet.`, 'Start new', true))) return;
    router.push(newWorkoutHref(routineId));
  };

  return (
    <Screen testID="routines-screen">
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>Routines</Title>
        <Button compact icon="add" label="New routine" onPress={() => router.push('/routine/new')} />
      </Row>
      {routines.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="No routines yet"
          body="Save the workouts you repeat — like Push, Pull, Legs — and start them with one tap, prefilled with your last weights."
          action={<Button label="Create a routine" icon="add" onPress={() => router.push('/routine/new')} />}
        />
      ) : (
        routines.map((r) => (
          <Card key={r.id} testID={`routine-${r.name}`}>
            <Body style={{ fontSize: 18, fontWeight: '700' }}>{r.name}</Body>
            {r.notes ? <Body muted style={{ fontSize: 14 }}>{r.notes}</Body> : null}
            <View style={{ gap: 2 }}>
              {r.exercises.map((e, i) => (
                <Body key={`${e.exerciseId}-${i}`} style={{ fontSize: 14 }}>
                  {exerciseName(e.exerciseId)} — {e.targetSets} × {e.targetReps}
                  {e.targetWeightKg ? ` @ ${formatKg(e.targetWeightKg)}` : ''}
                </Body>
              ))}
            </View>
            <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
              <Button compact icon="play" label="Start" accessibilityLabel={`Start ${r.name}`} onPress={() => void start(r.id)} />
              <Button compact variant="secondary" icon="create-outline" label="Edit" accessibilityLabel={`Edit ${r.name}`} onPress={() => router.push(`/routine/${r.id}`)} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
