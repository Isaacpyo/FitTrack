import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ExerciseEditor } from '../../components/ExerciseEditor';
import { ExercisePicker } from '../../components/ExercisePicker';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Banner, Body, Button, Card, EmptyState, IconButton, TextField } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { newId } from '../../lib/ids';
import { draftFromWorkout, newDraft, prefillSets, type DraftErrors } from '../../store/draft';
import { draftDiscarded, draftStarted, exerciseAdded, fieldChanged } from '../../store/draftSlice';
import { useAppDispatch, useAppSelector, useAppStore } from '../../store/hooks';
import { selectRoutineById, selectWorkouts } from '../../store/selectors';
import { deleteWorkout, saveDraft } from '../../store/thunks';
import { space } from '../../theme';

/**
 * Log a new workout (`/workout/new`, optionally `?routineId=`) or edit one (`/workout/<id>`).
 * Edits live in a persisted draft, so nothing is lost if the app closes mid-workout.
 */
export default function WorkoutEditor() {
  const { id, routineId, start } = useLocalSearchParams<{ id: string; routineId?: string; start?: string }>();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const draft = useAppSelector((s) => s.draft.current);
  const workouts = useAppSelector(selectWorkouts);
  const isNew = id === 'new';
  const existing = useAppSelector((s) => (isNew ? undefined : s.workouts.entities[id]));
  const routine = useAppSelector((s) => (routineId ? selectRoutineById(s, routineId) : undefined));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const initialised = useRef<string | null>(null);

  // Set up the draft once per route: a fresh one when asked (`start`), otherwise resume.
  useEffect(() => {
    const routeKey = `${id}:${routineId ?? ''}:${start ?? ''}`;
    if (initialised.current === routeKey) return;
    const current = store.getState().draft.current;
    if (isNew) {
      if (!start && current?.isNew) {
        initialised.current = routeKey;
        return;
      }
      dispatch(
        draftStarted(
          newDraft({ id: newId(), now: new Date(), history: selectWorkouts(store.getState()), newId, routine: routine ?? null }),
        ),
      );
      initialised.current = routeKey;
    } else if (existing) {
      if (current?.id !== existing.id) dispatch(draftStarted(draftFromWorkout(existing, newId)));
      initialised.current = routeKey;
    }
  }, [id, routineId, start, isNew, existing, routine, dispatch, store]);

  const editing = draft && (isNew ? draft.isNew : draft.id === id) ? draft : null;

  if (!isNew && !existing && !editing) {
    return (
      <Screen width="form">
        <ScreenHeader title="Workout" fallback="/history" />
        <EmptyState icon="search-outline" title="Workout not found" body="It may have been deleted on another device." />
      </Screen>
    );
  }
  if (!editing) return <Screen width="form">{null}</Screen>;

  const save = () => {
    const result = dispatch(saveDraft());
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(result.message);
      return;
    }
    setErrors({});
    router.replace(`/history?saved=${result.workout.id}`);
  };

  const discard = async () => {
    const ok = await confirm(
      isNew ? 'Discard workout?' : 'Discard changes?',
      isNew ? 'Everything you entered for this workout will be lost.' : 'Your saved workout stays as it was.',
      'Discard',
      true,
    );
    if (!ok) return;
    dispatch(draftDiscarded());
    if (router.canGoBack()) router.back();
    else router.replace(isNew ? '/today' : '/history');
  };

  const remove = async () => {
    if (!(await confirm('Delete workout?', `“${editing.name}” will be removed from your history on all devices.`, 'Delete', true))) return;
    dispatch(deleteWorkout(editing.id));
    router.replace('/history');
  };

  const addExercise = (exerciseId: string) => {
    setPickerOpen(false);
    dispatch(exerciseAdded({ key: newId(), exerciseId, sets: prefillSets(exerciseId, workouts, newId) }));
  };

  return (
    <Screen
      width="form"
      testID="workout-editor"
      footer={
        <>
          <Button variant="ghost" label="Discard" onPress={discard} />
          <Button label="Save workout" icon="checkmark" onPress={save} style={{ flexGrow: 1, maxWidth: 260 }} testID="save-workout" />
        </>
      }
    >
      <ScreenHeader
        title={isNew ? 'Log workout' : 'Edit workout'}
        fallback={isNew ? '/today' : '/history'}
        actions={!isNew ? <IconButton icon="trash-outline" label="Delete workout" color="#F87171" onPress={remove} /> : null}
      />

      {message ? (
        <Banner tone="danger" icon="alert-circle-outline" testID="workout-errors">
          <Body>{message}</Body>
        </Banner>
      ) : null}

      <Card style={{ gap: space.md }}>
        <TextField label="Workout name" value={editing.name} onChangeText={(value) => dispatch(fieldChanged({ field: 'name', value }))} error={errors.name} />
        <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
          <TextField
            style={{ flexGrow: 1, flexBasis: 150 }}
            label="Date"
            value={editing.date}
            onChangeText={(value) => dispatch(fieldChanged({ field: 'date', value }))}
            error={errors.date}
            hint="YYYY-MM-DD"
            autoCorrect={false}
          />
          <TextField
            style={{ flexGrow: 1, flexBasis: 150 }}
            label="Duration (minutes)"
            value={editing.durationMin}
            onChangeText={(value) => dispatch(fieldChanged({ field: 'durationMin', value }))}
            error={errors.durationMin}
            keyboardType="number-pad"
            placeholder="Optional"
          />
        </View>
        <TextField
          label="Notes"
          value={editing.notes}
          onChangeText={(value) => dispatch(fieldChanged({ field: 'notes', value }))}
          placeholder="How did it feel?"
          multiline
          maxLength={2000}
          inputStyle={{ minHeight: 72, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      {editing.exercises.length === 0 ? (
        <EmptyState icon="barbell-outline" title="No exercises yet" body="Add the exercises you’re doing. Sets are prefilled from last time." />
      ) : (
        editing.exercises.map((ex, i) => (
          <ExerciseEditor
            key={ex.key}
            exercise={ex}
            index={i}
            count={editing.exercises.length}
            history={workouts}
            draftId={editing.id}
            errors={errors}
          />
        ))
      )}

      <Button variant="secondary" icon="add" label="Add exercise" onPress={() => setPickerOpen(true)} testID="add-exercise" />
      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />
    </Screen>
  );
}
