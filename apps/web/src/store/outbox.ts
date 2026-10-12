import type { DailyActivity, RoutineInput, WorkoutInput } from '@fittrack/shared';

/**
 * Pure outbox logic. Every local write becomes an operation that is replayed against the API
 * once online. Operations are idempotent on the server, so retrying is always safe.
 */
export type OutboxOp =
  | { kind: 'workout.upsert'; entityId: string; payload: WorkoutInput }
  | { kind: 'workout.delete'; entityId: string; deletedAt: string }
  | { kind: 'routine.upsert'; entityId: string; payload: RoutineInput }
  | { kind: 'routine.delete'; entityId: string; deletedAt: string }
  | { kind: 'activity.upsert'; entityId: 'activity'; payload: DailyActivity[] };

export type OutboxItem = OutboxOp & {
  id: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export const MAX_ACTIVITY_DAYS_PER_ITEM = 92;

let seq = 0;
export function makeOutboxItem(op: OutboxOp, now: Date = new Date()): OutboxItem {
  seq += 1;
  return {
    ...op,
    id: `${op.kind}:${op.entityId}:${now.getTime()}:${seq}`,
    createdAt: now.toISOString(),
    attempts: 0,
  };
}

/** "workout:<id>", "routine:<id>" or "activity:activity" — the thing an operation changes. */
export function entityKey(op: Pick<OutboxOp, 'kind' | 'entityId'>): string {
  return `${op.kind.split('.')[0]}:${op.entityId}`;
}

function mergeActivity(older: DailyActivity[], newer: DailyActivity[]): DailyActivity[] {
  const byDate = new Map(older.map((d) => [d.date, d]));
  for (const d of newer) byDate.set(d.date, d);
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_ACTIVITY_DAYS_PER_ITEM);
}

/**
 * Add an operation, coalescing with a queued (not in-flight) operation on the same entity:
 * two edits become one upload, and an edit followed by a delete becomes just the delete.
 * The in-flight item is never touched — its response would otherwise acknowledge the wrong write.
 */
export function enqueueItem(
  items: OutboxItem[],
  item: OutboxItem,
  inFlightId: string | null,
): OutboxItem[] {
  const key = entityKey(item);
  const index = items.findIndex((i) => i.id !== inFlightId && entityKey(i) === key);
  if (index === -1) return [...items, item];

  const existing = items[index]!;
  let replacement: OutboxItem = { ...item, attempts: 0 };
  if (existing.kind === 'activity.upsert' && item.kind === 'activity.upsert') {
    replacement = { ...item, attempts: 0, payload: mergeActivity(existing.payload, item.payload) };
  }
  const next = [...items];
  next[index] = replacement;
  return next;
}

/** Entity keys with unsent local changes; pulls must not overwrite these. */
export function pendingKeys(items: OutboxItem[]): Set<string> {
  const keys = new Set<string>();
  for (const i of items) {
    if (i.kind === 'activity.upsert') for (const d of i.payload) keys.add(`activity:${d.date}`);
    else keys.add(entityKey(i));
  }
  return keys;
}

export type FailureKind = 'retry' | 'auth' | 'reject';

/** Network trouble and server errors are retried; a 4xx means this payload will never succeed. */
export function classifyFailure(status: number | string | undefined): FailureKind {
  if (typeof status !== 'number') return 'retry'; // FETCH_ERROR, TIMEOUT_ERROR, PARSING_ERROR…
  if (status === 401) return 'auth';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'reject';
}

/** Exponential backoff: 2 s, 4 s, 8 s … capped at 60 s. */
export function backoffMs(consecutiveFailures: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(1, consecutiveFailures));
}
