/**
 * Link that always starts a *new* workout draft (the `start` nonce), as opposed to
 * `/workout/new`, which resumes the one in progress.
 */
export function newWorkoutHref(routineId?: string): string {
  const start = Date.now().toString(36);
  return routineId ? `/workout/new?routineId=${routineId}&start=${start}` : `/workout/new?start=${start}`;
}
