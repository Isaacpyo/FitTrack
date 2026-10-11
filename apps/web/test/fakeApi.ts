import type { Workout } from '@fittrack/shared';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** In-memory stand-in for the FitTrack API, installed as global fetch. */
export class FakeApi {
  workouts = new Map<string, Workout>();
  requests: { method: string; path: string; body?: unknown; auth: string | null }[] = [];
  offline = false;
  delayMs = 0;
  failures: { status: number; path?: string }[] = [];

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    if (this.offline) throw new TypeError('Failed to fetch');
    const url = new URL(req.url);
    const body =
      req.method === 'PUT' || req.method === 'POST' || req.method === 'PATCH'
        ? await req.json()
        : undefined;
    this.requests.push({
      method: req.method,
      path: url.pathname,
      body,
      auth: req.headers.get('authorization'),
    });
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));

    const failureIndex = this.failures.findIndex((f) => !f.path || url.pathname.startsWith(f.path));
    if (failureIndex >= 0) {
      const [failure] = this.failures.splice(failureIndex, 1);
      return json(failure!.status, {
        error: { code: 'injected', message: `Injected ${failure!.status}` },
      });
    }

    const workoutMatch = url.pathname.match(/^\/workouts\/(.+)$/);
    if (url.pathname === '/healthz') return json(200, { ok: true, db: 'up' });
    if (url.pathname === '/sync/changes') {
      return json(200, {
        serverTime: new Date().toISOString(),
        workouts: [...this.workouts.values()],
        routines: [],
        activity: [],
      });
    }
    if (workoutMatch && req.method === 'PUT') {
      const incoming = body as Workout;
      const existing = this.workouts.get(incoming.id);
      if (existing && existing.updatedAt > incoming.updatedAt)
        return json(200, { applied: false, item: existing });
      const item = { ...incoming, deletedAt: null };
      this.workouts.set(item.id, item);
      return json(200, { applied: true, item });
    }
    if (workoutMatch && req.method === 'DELETE') {
      this.workouts.delete(workoutMatch[1]!);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/activity')
      return json(200, { updated: (body as { days: unknown[] }).days.length });
    return json(404, { error: { code: 'not_found', message: 'Not found' } });
  };

  writes(): string[] {
    return this.requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.path}`);
  }
}
