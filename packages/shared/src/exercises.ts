export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full_body';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  /** Bodyweight movements are tracked by reps; added load is optional. */
  bodyweight: boolean;
}

/**
 * The exercise catalog is shared by client and server. The API seeds it into Postgres and
 * validates exercise ids against it; the app bundles it so the picker works offline.
 * Ids are stable slugs — never rename one, add a new entry instead.
 */
export const EXERCISES: readonly Exercise[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'chest',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'dumbbell-fly',
    name: 'Dumbbell Fly',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'cable-crossover',
    name: 'Cable Crossover',
    muscleGroup: 'chest',
    equipment: 'cable',
    bodyweight: false,
  },
  {
    id: 'push-up',
    name: 'Push-up',
    muscleGroup: 'chest',
    equipment: 'bodyweight',
    bodyweight: true,
  },
  { id: 'dip', name: 'Dip', muscleGroup: 'chest', equipment: 'bodyweight', bodyweight: true },
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'back',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    muscleGroup: 'back',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'pull-up',
    name: 'Pull-up',
    muscleGroup: 'back',
    equipment: 'bodyweight',
    bodyweight: true,
  },
  {
    id: 'chin-up',
    name: 'Chin-up',
    muscleGroup: 'back',
    equipment: 'bodyweight',
    bodyweight: true,
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'back',
    equipment: 'cable',
    bodyweight: false,
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    muscleGroup: 'back',
    equipment: 'cable',
    bodyweight: false,
  },
  {
    id: 'dumbbell-row',
    name: 'One-arm Dumbbell Row',
    muscleGroup: 'back',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'back-squat',
    name: 'Back Squat',
    muscleGroup: 'legs',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'front-squat',
    name: 'Front Squat',
    muscleGroup: 'legs',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroup: 'legs',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'legs',
    equipment: 'machine',
    bodyweight: false,
  },
  {
    id: 'walking-lunge',
    name: 'Walking Lunge',
    muscleGroup: 'legs',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl',
    muscleGroup: 'legs',
    equipment: 'machine',
    bodyweight: false,
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    muscleGroup: 'legs',
    equipment: 'machine',
    bodyweight: false,
  },
  {
    id: 'calf-raise',
    name: 'Standing Calf Raise',
    muscleGroup: 'legs',
    equipment: 'machine',
    bodyweight: false,
  },
  {
    id: 'hip-thrust',
    name: 'Hip Thrust',
    muscleGroup: 'legs',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'overhead-press',
    name: 'Overhead Press',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'lateral-raise',
    name: 'Lateral Raise',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    muscleGroup: 'shoulders',
    equipment: 'cable',
    bodyweight: false,
  },
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    muscleGroup: 'arms',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscleGroup: 'arms',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
    muscleGroup: 'arms',
    equipment: 'dumbbell',
    bodyweight: false,
  },
  {
    id: 'triceps-pushdown',
    name: 'Triceps Pushdown',
    muscleGroup: 'arms',
    equipment: 'cable',
    bodyweight: false,
  },
  {
    id: 'skull-crusher',
    name: 'Skull Crusher',
    muscleGroup: 'arms',
    equipment: 'barbell',
    bodyweight: false,
  },
  {
    id: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    muscleGroup: 'core',
    equipment: 'bodyweight',
    bodyweight: true,
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    muscleGroup: 'core',
    equipment: 'bodyweight',
    bodyweight: true,
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    muscleGroup: 'core',
    equipment: 'cable',
    bodyweight: false,
  },
  {
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    muscleGroup: 'full_body',
    equipment: 'kettlebell',
    bodyweight: false,
  },
  {
    id: 'power-clean',
    name: 'Power Clean',
    muscleGroup: 'full_body',
    equipment: 'barbell',
    bodyweight: false,
  },
];

export const EXERCISES_BY_ID: ReadonlyMap<string, Exercise> = new Map(
  EXERCISES.map((e) => [e.id, e]),
);

export function isExerciseId(id: string): boolean {
  return EXERCISES_BY_ID.has(id);
}

export function exerciseName(id: string): string {
  return EXERCISES_BY_ID.get(id)?.name ?? id;
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full body',
};
