import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft, DraftExercise, DraftSet } from './draft';

export interface DraftState {
  current: Draft | null;
}

type DraftField = 'name' | 'date' | 'durationMin' | 'notes';

const draftSlice = createSlice({
  name: 'draft',
  initialState: { current: null } as DraftState,
  reducers: {
    draftStarted(state, action: PayloadAction<Draft>) {
      state.current = action.payload;
    },
    draftDiscarded(state) {
      state.current = null;
    },
    fieldChanged(state, action: PayloadAction<{ field: DraftField; value: string }>) {
      if (state.current) state.current[action.payload.field] = action.payload.value;
    },
    exerciseAdded(state, action: PayloadAction<DraftExercise>) {
      state.current?.exercises.push(action.payload);
    },
    exerciseRemoved(state, action: PayloadAction<string>) {
      if (state.current) state.current.exercises = state.current.exercises.filter((e) => e.key !== action.payload);
    },
    exerciseMoved(state, action: PayloadAction<{ key: string; direction: -1 | 1 }>) {
      const list = state.current?.exercises;
      if (!list) return;
      const from = list.findIndex((e) => e.key === action.payload.key);
      const to = from + action.payload.direction;
      if (from < 0 || to < 0 || to >= list.length) return;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved!);
    },
    setAdded(state, action: PayloadAction<{ exerciseKey: string; set: DraftSet }>) {
      state.current?.exercises.find((e) => e.key === action.payload.exerciseKey)?.sets.push(action.payload.set);
    },
    setRemoved(state, action: PayloadAction<{ exerciseKey: string; setId: string }>) {
      const ex = state.current?.exercises.find((e) => e.key === action.payload.exerciseKey);
      if (ex) ex.sets = ex.sets.filter((s) => s.id !== action.payload.setId);
    },
    setChanged(
      state,
      action: PayloadAction<{ exerciseKey: string; setId: string; field: 'weightKg' | 'reps'; value: string }>,
    ) {
      const { exerciseKey, setId, field, value } = action.payload;
      const set = state.current?.exercises.find((e) => e.key === exerciseKey)?.sets.find((s) => s.id === setId);
      if (set) set[field] = value;
    },
  },
});

export const {
  draftStarted,
  draftDiscarded,
  fieldChanged,
  exerciseAdded,
  exerciseRemoved,
  exerciseMoved,
  setAdded,
  setRemoved,
  setChanged,
} = draftSlice.actions;
export default draftSlice.reducer;
