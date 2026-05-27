import { apiFetch, isApiUnavailable } from "./apiClient";

const PROFILE_KEY = "ht_profile";
const SESSION_KEY = "ht_session";
const API_UNAVAILABLE_MESSAGE =
  "Cloud auth is not connected. Start the API server with Supabase env vars, then try again.";

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName || user.user_metadata?.display_name || user.user_metadata?.name || "",
    email: user.email,
    createdAt: user.createdAt || user.created_at,
  };
}

function cacheUser(user) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  localStorage.setItem(SESSION_KEY, "1");
}

export function getUser() {
  if (localStorage.getItem(SESSION_KEY) !== "1") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.email) return null;
    return { id: p.id, displayName: p.displayName || "", email: p.email, createdAt: p.createdAt };
  } catch {
    return null;
  }
}

export async function refreshUser() {
  try {
    const { user } = await apiFetch("/api/auth/user");
    const normalizedUser = normalizeUser(user);
    cacheUser(normalizedUser);
    return normalizedUser;
  } catch (error) {
    cacheUser(null);
    return null;
  }
}

export function subscribeToAuth(callback) {
  const listener = (event) => callback(event.detail);
  window.addEventListener("habit-auth-change", listener);
  return () => window.removeEventListener("habit-auth-change", listener);
}

function notifyAuthChange(user) {
  window.dispatchEvent(new CustomEvent("habit-auth-change", { detail: user }));
}

export async function signUp({ displayName, email, password }) {
  try {
    const result = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ displayName, email, password }),
    });
    const user = normalizeUser(result.user);
    if (user) cacheUser(user);
    notifyAuthChange(user);
    return { ok: true, user, needsEmailConfirmation: result.needsEmailConfirmation };
  } catch (error) {
    return {
      ok: false,
      error: isApiUnavailable(error) ? API_UNAVAILABLE_MESSAGE : error.message,
    };
  }
}

export async function logIn({ email, password }) {
  try {
    const result = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const user = normalizeUser(result.user);
    cacheUser(user);
    notifyAuthChange(user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: isApiUnavailable(error) ? API_UNAVAILABLE_MESSAGE : error.message,
    };
  }
}

export async function logOut() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
  }
  cacheUser(null);
  notifyAuthChange(null);
}
