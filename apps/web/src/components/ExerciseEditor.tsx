import {
  exerciseName,
  EXERCISES_BY_ID,
  formatShortDate,
  lastPerformance,
  type Workout,
} from '@fittrack/shared';
import { StyleSheet, Text, View } from 'react-native';
import { newId } from '../lib/ids';
import { summariseSets } from '../lib/format';
import type { DraftErrors, DraftExercise } from '../store/draft';
import {
  exerciseMoved,
  exerciseRemoved,
  setAdded,
  setChanged,
  setRemoved,
} from '../store/draftSlice';
import { useAppDispatch } from '../store/hooks';
import { colors, space } from '../theme';
import { Body, Button, Card, IconButton, Row, TextField } from './ui';

interface Props {
  exercise: DraftExercise;
  index: number;
  count: number;
  history: Workout[];
  draftId: string;
  errors: DraftErrors;
}

/** One exercise in the workout logger: its sets as weight/reps rows. */
export function ExerciseEditor({ exercise, index, count, history, draftId, errors }: Props) {
  const dispatch = useAppDispatch();
  const name = exerciseName(exercise.exerciseId);
  const bodyweight = EXERCISES_BY_ID.get(exercise.exerciseId)?.bodyweight ?? false;
  const last = lastPerformance(history, exercise.exerciseId, draftId);
  const exerciseError = errors[`exercise:${exercise.key}`];

  const addSet = () => {
    const prev = exercise.sets[exercise.sets.length - 1];
    dispatch(
      setAdded({
        exerciseKey: exercise.key,
        set: {
          id: newId(),
          weightKg: prev?.weightKg ?? (bodyweight ? '0' : ''),
          reps: prev?.reps ?? '',
        },
      }),
    );
  };

  return (
    <Card testID={`exercise-${exercise.exerciseId}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} accessibilityRole="header">
            {name}
          </Text>
          <Body muted style={{ fontSize: 13 }}>
            {last
              ? `Last time (${formatShortDate(last.date)}): ${summariseSets(last.sets)}`
              : 'First time logging this exercise'}
          </Body>
        </View>
        <IconButton
          icon="arrow-up"
          label={`Move ${name} up`}
          disabled={index === 0}
          onPress={() => dispatch(exerciseMoved({ key: exercise.key, direction: -1 }))}
        />
        <IconButton
          icon="arrow-down"
          label={`Move ${name} down`}
          disabled={index === count - 1}
          onPress={() => dispatch(exerciseMoved({ key: exercise.key, direction: 1 }))}
        />
        <IconButton
          icon="trash-outline"
          label={`Remove ${name}`}
          color={colors.danger}
          onPress={() => dispatch(exerciseRemoved(exercise.key))}
        />
      </Row>

      <View
        style={styles.headerRow}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.col, styles.setCol]}>Set</Text>
        <Text style={[styles.col, styles.inputCol]}>{bodyweight ? '+kg' : 'kg'}</Text>
        <Text style={[styles.col, styles.inputCol]}>Reps</Text>
        <View style={{ width: 44 }} />
      </View>
      {exercise.sets.map((set, i) => (
        <View key={set.id} style={styles.setRow}>
          <Text style={[styles.setNumber, styles.setCol]}>{i + 1}</Text>
          <TextField
            hideLabel
            label={`${name} set ${i + 1} weight (kg)`}
            value={set.weightKg}
            onChangeText={(value) =>
              dispatch(
                setChanged({ exerciseKey: exercise.key, setId: set.id, field: 'weightKg', value }),
              )
            }
            keyboardType="decimal-pad"
            placeholder="0"
            error={errors[`set:${set.id}:weightKg`]}
            style={styles.inputCol}
            inputStyle={styles.input}
          />
          <TextField
            hideLabel
            label={`${name} set ${i + 1} reps`}
            value={set.reps}
            onChangeText={(value) =>
              dispatch(
                setChanged({ exerciseKey: exercise.key, setId: set.id, field: 'reps', value }),
              )
            }
            keyboardType="number-pad"
            placeholder="0"
            error={errors[`set:${set.id}:reps`]}
            style={styles.inputCol}
            inputStyle={styles.input}
          />
          <IconButton
            icon="close"
            label={`Remove ${name} set ${i + 1}`}
            onPress={() => dispatch(setRemoved({ exerciseKey: exercise.key, setId: set.id }))}
          />
        </View>
      ))}
      {exerciseError ? (
        <Body style={{ color: colors.danger, fontSize: 13 }}>{exerciseError}</Body>
      ) : null}
      <Button
        compact
        variant="ghost"
        icon="add"
        label="Add set"
        accessibilityLabel={`Add set to ${name}`}
        onPress={addSet}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  headerRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.sm },
  setRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  col: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  setCol: { width: 32, textAlign: 'center' },
  setNumber: { color: colors.textMuted, fontSize: 16, fontWeight: '700', lineHeight: 48 },
  inputCol: { flex: 1 },
  input: { textAlign: 'center', minHeight: 44 },
});
