import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@fittrack/shared';
import { signedIn, signedOut } from './actions';

export interface SessionState {
  token: string | null;
  user: User | null;
  /**
   * The server rejected the token. `user` is kept so local data stays attached to its owner
   * until they sign in again.
   */
  expired: boolean;
}

const initialState: SessionState = { token: null, user: null, expired: false };

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    expiredNoticeDismissed(state) {
      state.expired = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signedIn, (_state, action) => ({
        token: action.payload.token,
        user: action.payload.user,
        expired: false,
      }))
      .addCase(signedOut, (state, action) =>
        action.payload.reason === 'expired'
          ? { token: null, user: state.user, expired: true }
          : initialState,
      );
  },
});

export const { userUpdated, expiredNoticeDismissed } = sessionSlice.actions;
export default sessionSlice.reducer;
