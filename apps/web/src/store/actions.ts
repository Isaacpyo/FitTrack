import { createAction } from '@reduxjs/toolkit';
import type { AuthResponse, SyncChangesResponse } from '@fittrack/shared';

/** Cross-slice actions live here so slices never import each other. */
export const hydrated = createAction('app/hydrated');
export const appForegrounded = createAction('app/foregrounded');

export const signedIn = createAction<AuthResponse>('session/signedIn');
export const signedOut = createAction<{ reason: 'user' | 'expired' }>('session/signedOut');

export const flushRequested = createAction('sync/flushRequested');
export const pullRequested = createAction('sync/pullRequested');

/** `pending` = entity keys with unsent local edits, which a pull must not overwrite. */
export const changesPulled = createAction<{ response: SyncChangesResponse; pending: string[] }>(
  'sync/changesPulled',
);
