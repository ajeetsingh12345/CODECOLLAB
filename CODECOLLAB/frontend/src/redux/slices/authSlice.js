import { createSlice } from "@reduxjs/toolkit";
const initialState = { user: null, accessToken: null, authResolved: false };
const authSlice = createSlice({
  name: "auth", initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.authResolved = true;
    },
    clearCredentials: state => {
      state.user = null;
      state.accessToken = null;
      state.authResolved = true;
    }
  }
});
export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
