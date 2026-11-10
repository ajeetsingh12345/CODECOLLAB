import { store } from "../redux/store";
import { clearCredentials, setCredentials } from "../redux/slices/authSlice";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
let sessionRefresh;

export async function restoreSession() {
  if (!sessionRefresh) {
    sessionRefresh = (async () => {
      const response = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Unable to restore session");

      const { accessToken, user: restoredUser } = await response.json();
      if (restoredUser) return { user: restoredUser, accessToken };
      const profileResponse = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        cache: "no-store"
      });
      if (!profileResponse.ok) throw new Error("Unable to restore session profile");

      const { user } = await profileResponse.json();
      return { user, accessToken };
    })().finally(() => {
      sessionRefresh = null;
    });
  }

  try {
    const credentials = await sessionRefresh;
    if (credentials) store.dispatch(setCredentials(credentials));
    else store.dispatch(clearCredentials());
    return credentials;
  } catch (error) {
    store.dispatch(clearCredentials());
    throw error;
  }
}

async function send(path, options, token) {
  const headers = {
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
}

export async function api(path, options = {}, token) {
  let response = await send(path, options, token);
  if (response.status === 401 && token && !path.startsWith("/auth/")) {
    const credentials = await restoreSession();
    if (credentials) response = await send(path, options, credentials.accessToken);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
