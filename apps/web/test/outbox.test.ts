import { describe, expect, it } from 'vitest';
import { backoffMs, classifyFailure, enqueueItem, makeOutboxItem, pendingKeys, type OutboxItem } from '../src/store/outbox';
import { workoutInput } from './fixtures';

const upsert = (id: string, name = 'W') =>
  makeOutboxItem({ kind: 'workout.upsert', entityId: id, payload: { ...workoutInput(id), name } });
const del = (id: string) => makeOutboxItem({ kind: 'workout.delete', entityId: id, deletedAt: '2026-10-10T10:00:00.000Z' });
const activity = (dates: [string, number][]) =>
  makeOutboxItem({
    kind: 'activity.upsert',
    entityId: 'activity',
    payload: dates.map(([date, steps]) => ({ date, steps, activeMinutes: 10, energyKcal: 100, source: 'mock' as const })),
  });

describe('enqueueItem', () => {
  it('coalesces repeated edits of the same entity into the latest one, in place', () => {
    let q: OutboxItem[] = [];
    q = enqueueItem(q, upsert('a', 'first'), null);
    q = enqueueItem(q, upsert('b'), null);
    q = enqueueItem(q, upsert('a', 'second'), null);
    expect(q).toHaveLength(2);
    expect(q[0]!.kind === 'workout.upsert' && q[0]!.payload.name).toBe('second');
  });

  it('replaces a queued edit with a later delete', () => {
    const q = enqueueItem([upsert('a')], del('a'), null);
    expect(q.map((i) => i.kind)).toEqual(['workout.delete']);
  });

  it('never touches the item that is in flight', () => {
    const first = upsert('a', 'first');
    const q = enqueueItem([first], upsert('a', 'second'), first.id);
    expect(q).toHaveLength(2);
    expect(q[0]).toBe(first);
  });

  it('merges activity batches by day, newest values winning', () => {
    const q = enqueueItem([activity([['2026-10-01', 100], ['2026-10-02', 200]])], activity([['2026-10-02', 250]]), null);
    expect(q).toHaveLength(1);
    expect(q[0]!.kind === 'activity.upsert' && q[0]!.payload.map((d) => d.steps)).toEqual([100, 250]);
  });

  it('does not merge different kinds of entity', () => {
    const r = makeOutboxItem({ kind: 'routine.delete', entityId: 'a', deletedAt: '2026-10-10T10:00:00Z' });
    expect(enqueueItem([upsert('a')], r, null)).toHaveLength(2);
  });
});

describe('outbox helpers', () => {
  it('lists pending entity keys, including each activity day', () => {
    const keys = pendingKeys([upsert('a'), activity([['2026-10-01', 1]])]);
    expect([...keys].sort()).toEqual(['activity:2026-10-01', 'workout:a']);
  });

  it('classifies failures', () => {
    expect(classifyFailure('FETCH_ERROR')).toBe('retry');
    expect(classifyFailure('TIMEOUT_ERROR')).toBe('retry');
    expect(classifyFailure(503)).toBe('retry');
    expect(classifyFailure(429)).toBe('retry');
    expect(classifyFailure(401)).toBe('auth');
    expect(classifyFailure(400)).toBe('reject');
    expect(classifyFailure(404)).toBe('reject');
  });

  it('backs off exponentially up to a minute', () => {
    expect([1, 2, 3, 4, 10].map(backoffMs)).toEqual([2000, 4000, 8000, 16000, 60000]);
  });
});
