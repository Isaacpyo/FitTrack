import type { ThunkAction, ThunkDispatch, TypedStartListening, UnknownAction } from '@reduxjs/toolkit';
import type { KeyValueStorage, TokenStorage } from '../lib/storage';
import type { RootState } from './rootReducer';

export type { RootState };

/** Injected platform services — real ones in the app, in-memory ones in tests. */
export interface StoreDeps {
  storage: KeyValueStorage;
  tokenStorage: TokenStorage;
  now: () => Date;
}

export type AppDispatch = ThunkDispatch<RootState, StoreDeps, UnknownAction>;
export type AppThunk<R = void> = ThunkAction<R, RootState, StoreDeps, UnknownAction>;
export type AppStartListening = TypedStartListening<RootState, AppDispatch, StoreDeps>;
