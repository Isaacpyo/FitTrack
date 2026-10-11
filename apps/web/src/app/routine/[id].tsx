import { exerciseName, routineInputSchema } from '@fittrack/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ExercisePicker } from '../../components/ExercisePicker';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Banner, Body, Button, Card, EmptyState, IconButton, Row, TextField } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { newId } from '../../lib/ids';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectRoutineById } from '../../store/selectors';
import { deleteRoutine, saveRoutine } from '../../store/thunks';
import { colors, space } from '../../theme';

interface Row_ {
  key: string;
  exerciseId: string;
  sets: string;
  reps: string;
  weight: string;
}

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/routines'));

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const isNew = id === 'new';
  const existing = useAppSelector((s) => (isNew ? undefined : selectRoutineById(s, id)));
  const [routineId] = useState(() => (isNew ? newId() : id));
  const [name, setName] = useState(existing?.name ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [rows, setRows] = useState<Row_[]>(
    () =>
      existing?.exercises.map((e) => ({
        key: newId(),
        exerciseId: e.exerciseId,
        sets: String(e.targetSets),
        reps: String(e.targetReps),
        weight: e.targetWeightKg === null ? '' : String(e.targetWeightKg),
      })) ?? [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  if (!isNew && !existing) {
    return (
      <Screen width="form">
        <ScreenHeader title="Routine" fallback="/routines" />
        <EmptyState icon="search-outline" title="Routine not found" body="It may have been deleted on another device." />
      </Screen>
    );
  }

  const update = (key: string, patch: Partial<Row_>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    const candidate = {
      id: routineId,
      name,
      notes,
      updatedAt: new Date().toISOString(),
      exercises: rows.map((r) => ({
        exerciseId: r.exerciseId,
        targetSets: Number(r.sets),
        targetReps: Number(r.reps),
        targetWeightKg: r.weight.trim() === '' ? null : Number(r.weight.replace(',', '.')),
      })),
    };
    const parsed = routineInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [first, index, field] = issue.path;
        if (first === 'exercises' && typeof index === 'number' && rows[index]) next[`${rows[index]!.key}:${String(field)}`] ??= issue.message;
        else next[String(first)] ??= issue.message;
      }
      setErrors(next);
      setMessage(next.exercises ?? next.name ?? 'Please fix the highlighted fields');
      return;
    }
    const { updatedAt: _ignored, ...input } = parsed.data;
    dispatch(saveRoutine(input));
    goBack();
  };

  const remove = async () => {
    if (!(await confirm('Delete routine?', `“${name}” will be deleted. Past workouts are kept.`, 'Delete', true))) return;
    dispatch(deleteRoutine(routineId));
    goBack();
  };

  return (
    <Screen
      width="form"
      testID="routine-editor"
      footer={
        <>
          <Button variant="ghost" label="Cancel" onPress={goBack} />
          <Button label="Save routine" icon="checkmark" onPress={save} style={{ flexGrow: 1, maxWidth: 260 }} />
        </>
      }
    >
      <ScreenHeader
        title={isNew ? 'New routine' : 'Edit routine'}
        fallback="/routines"
        actions={!isNew ? <IconButton icon="trash-outline" label="Delete routine" color={colors.danger} onPress={remove} /> : null}
      />
      {message ? (
        <Banner tone="danger" icon="alert-circle-outline">
          <Body>{message}</Body>
        </Banner>
      ) : null}
      <Card style={{ gap: space.md }}>
        <TextField label="Routine name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Upper body" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline maxLength={1000} />
      </Card>
      {rows.map((r, i) => {
        const exName = exerciseName(r.exerciseId);
        return (
          <Card key={r.key}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700', flex: 1 }}>
                {i + 1}. {exName}
              </Body>
              <IconButton icon="trash-outline" label={`Remove ${exName}`} color={colors.danger} onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            </Row>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <TextField style={{ flex: 1 }} label="Sets" value={r.sets} onChangeText={(sets) => update(r.key, { sets })} keyboardType="number-pad" error={errors[`${r.key}:targetSets`] && '1–20'} />
              <TextField style={{ flex: 1 }} label="Reps" value={r.reps} onChangeText={(reps) => update(r.key, { reps })} keyboardType="number-pad" error={errors[`${r.key}:targetReps`] && '1–100'} />
              <TextField style={{ flex: 1 }} label="kg" value={r.weight} onChangeText={(weight) => update(r.key, { weight })} keyboardType="decimal-pad" placeholder="—" error={errors[`${r.key}:targetWeightKg`] && '0–1000'} />
            </View>
          </Card>
        );
      })}
      <Button variant="secondary" icon="add" label="Add exercise" onPress={() => setPickerOpen(true)} />
      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exerciseId) => {
          setPickerOpen(false);
          setRows((rs) => [...rs, { key: newId(), exerciseId, sets: '3', reps: '8', weight: '' }]);
        }}
      />
    </Screen>
  );
}
