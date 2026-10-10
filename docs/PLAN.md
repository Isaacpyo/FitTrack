# FitTrack — MVP plan

FitTrack is an offline-first workout tracker. Users log sets/reps/weight, save reusable
routines, see personal records, progress charts and streaks, and sync steps/activity from
Apple Health (iOS) or Health Connect (Android). The same Expo codebase ships to iOS, Android
and the web (Netlify).

## Stack

| Layer    | Choice                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| Client   | Expo SDK 57, Expo Router, React Native (+ react-native-web), TypeScript      |
| State    | Redux Toolkit (slices + listener middleware) and RTK Query for all HTTP      |
| Charts   | Small in-house SVG charts on `react-native-svg` (works identically on web)   |
| Health   | `@kingstinct/react-native-healthkit`, `react-native-health-connect`, mock    |
| API      | Node 22, Fastify 5, Zod validation, JWT auth, `node:crypto` scrypt passwords |
| Database | Postgres (Neon in production, `postgres:17` container locally)               |
| Shared   | `packages/shared`: Zod schemas, exercise catalog, pure fitness logic          |

## Repository layout

```
apps/web         Expo app (iOS / Android / web export -> Netlify)
apps/api         Fastify API (-> Render free web service)
packages/shared  Schemas, types, exercise catalog, PR / streak / volume maths, demo data
e2e/             Playwright smoke test against the exported web build + real API
docs/            This plan
```

`packages/shared` is an internal "just-in-time" package: it exports TypeScript source.
Metro, Vitest and `tsx` compile it directly; the API production build (tsup) bundles it.

## Data model (Postgres)

- `users(id, email unique, password_hash, display_name, step_goal, is_demo, created_at)`
- `exercises(id slug pk, name, muscle_group, equipment, is_bodyweight)` — seeded from the
  shared catalog so client and server agree on ids without a network round-trip.
- `routines(id uuid pk, user_id, name, notes, exercises jsonb, updated_at, deleted_at,
  server_updated_at)` — a routine is a template read/written as a whole, so JSONB
  (validated by Zod) keeps it simple.
- `workouts(id uuid pk, user_id, routine_id, name, started_at, duration_min, notes,
  updated_at, deleted_at, server_updated_at)`
- `workout_sets(id uuid pk, workout_id, exercise_id, exercise_order, set_order, reps,
  weight_kg)` — normalised because sets are the analytics data (volume, PRs).
- `activity_daily(user_id, day, steps, active_minutes, energy_kcal, source,
  server_updated_at)` — one row per user per local day.

IDs are UUIDs generated on the client, which is what makes offline creation and idempotent
retries possible.

## Offline-first sync protocol

1. Every user write (workout / routine / activity upsert or delete) updates local Redux
   state immediately and appends an item to a persisted **outbox**.
2. Outbox items are coalesced per entity (two edits to the same workout become one upload;
   create-then-delete of an unsynced workout cancels out). The in-flight item is never
   coalesced.
3. A listener-middleware **sync engine** flushes the outbox in order whenever it changes,
   the device comes back online, or the app starts. Network/5xx errors stop the flush and
   retry with exponential backoff; 4xx errors move the item to a visible "failed" list so
   one bad item never blocks the queue.
4. Writes are idempotent `PUT /workouts/:id` / `DELETE /workouts/:id`. The server applies
   **last-write-wins** on the client `updatedAt`; a stale write gets the current server
   copy back, which the client adopts.
5. Pulls use `GET /sync/changes?since=<serverTime>` and include tombstones (`deletedAt`) so
   deletions propagate between devices. Entities with pending local changes are not
   overwritten by a pull.

Stats (PRs, streaks, volume, progress series) are computed on the client from local state
with the shared pure functions, so they work offline and include unsynced workouts.

## Health data

`HealthProvider` interface with three implementations picked at runtime:

- iOS dev-client build: HealthKit (steps, active energy, exercise minutes)
- Android dev-client build: Health Connect (steps, active calories, exercise sessions)
- Web, Expo Go, tests, or `EXPO_PUBLIC_HEALTH_PROVIDER=mock`: deterministic mock data

Native modules are loaded lazily so Expo Go and web never import them.

## Demo account

`POST /auth/demo` creates a short-lived demo user (purged after `DEMO_TTL_HOURS`) seeded with
~10 weeks of progressive-overload workouts, three routines and 60 days of activity,
generated relative to *today* so streaks and charts always look current. Each visitor gets
their own sandbox, so one visitor's edits never leak to another. `npm run db:seed` also
creates a fixed local account `demo@fittrack.dev` / `demo-password`.

## Hosting

- Web: `expo export -p web` (single-page app) on the existing Netlify site.
- API: Render free web service (`render.yaml`). Free instances sleep, so the client shows a
  "Waking the server…" banner when a request takes longer than ~3 s and pings `/healthz`
  at startup to start the wake-up early.
- DB: Neon free Postgres.

## Testing

- Unit (Vitest): shared fitness logic and schemas; client outbox/sync/persistence logic.
- Integration (Vitest + real Postgres): API auth, ownership, LWW, sync pull, demo.
- E2E (Playwright): demo login → log a workout → go offline → log another → reconnect →
  queue drains → progress page renders.
- CI (GitHub Actions): install, lint, typecheck, unit + integration, e2e.

## Known trade-offs / tech debt

- JWT access tokens only (30 days), no refresh-token rotation or revocation list.
- Whole-history client cache; very large histories would want paging on first sync.
- Stats are client-computed; a server-side stats endpoint would be needed for other clients.
- kg only; no unit preference yet.
