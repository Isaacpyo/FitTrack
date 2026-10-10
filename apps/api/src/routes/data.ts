import {
  activityBatchSchema,
  routineInputSchema,
  syncChangesQuerySchema,
  workoutInputSchema,
  type SyncChangesResponse,
} from '@fittrack/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { badRequest, parse } from '../errors';
import { activityChangedSince, upsertActivity } from '../repos/activity';
import { deleteRoutine, routinesChangedSince, upsertRoutine } from '../repos/routines';
import { deleteWorkout, upsertWorkout, workoutsChangedSince } from '../repos/workouts';

const idParams = z.object({ id: z.uuid('Invalid id') });
const deleteQuery = z.object({ deletedAt: z.iso.datetime({ offset: true }).optional() });

function assertBodyMatchesPath(pathId: string, bodyId: string): void {
  if (pathId !== bodyId) throw badRequest('Body id does not match the URL');
}

/** Offline-sync endpoints: idempotent upserts/deletes plus an incremental pull. */
export async function dataRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.get('/sync/changes', async (request) => {
    const { since } = parse(syncChangesQuerySchema, request.query);
    // Read the clock first: anything written after this moment is picked up by the next pull.
    const { rows } = await pool.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    const [workouts, routines, activity] = await Promise.all([
      workoutsChangedSince(pool, request.userId, since ?? null),
      routinesChangedSince(pool, request.userId, since ?? null),
      activityChangedSince(pool, request.userId, since ?? null),
    ]);
    const body: SyncChangesResponse = {
      serverTime: rows[0]!.now.toISOString(),
      workouts,
      routines,
      activity,
    };
    return body;
  });

  app.put('/workouts/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(workoutInputSchema, request.body);
    assertBodyMatchesPath(id, input.id);
    return upsertWorkout(pool, request.userId, input);
  });

  app.delete('/workouts/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const { deletedAt } = parse(deleteQuery, request.query);
    await deleteWorkout(pool, request.userId, id, deletedAt ?? new Date().toISOString());
    return reply.code(204).send();
  });

  app.put('/routines/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(routineInputSchema, request.body);
    assertBodyMatchesPath(id, input.id);
    return upsertRoutine(pool, request.userId, input);
  });

  app.delete('/routines/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const { deletedAt } = parse(deleteQuery, request.query);
    await deleteRoutine(pool, request.userId, id, deletedAt ?? new Date().toISOString());
    return reply.code(204).send();
  });

  app.put('/activity', async (request) => {
    const { days } = parse(activityBatchSchema, request.body);
    const updated = await upsertActivity(pool, request.userId, days);
    return { updated };
  });
}
