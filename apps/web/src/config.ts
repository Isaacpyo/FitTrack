/**
 * Build-time configuration. Expo inlines `process.env.EXPO_PUBLIC_*` when bundling, so these
 * must be read with direct property access.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '') || 'http://localhost:4000';

/** 'mock' forces the mock health provider on native too (e.g. in Expo Go or simulators). */
export const HEALTH_PROVIDER_OVERRIDE = process.env.EXPO_PUBLIC_HEALTH_PROVIDER;

/** After this long a request is assumed to be waiting on a sleeping free-tier server. */
export const SLOW_REQUEST_MS = 3000;

/** Render's free tier can take ~50 s to cold-start, so allow well over that. */
export const REQUEST_TIMEOUT_MS = 90_000;
