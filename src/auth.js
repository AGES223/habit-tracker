import { hasSupabaseConfig, supabase } from "./supabaseClient";

const PROFILE_KEY = "ht_profile";
const SESSION_KEY = "ht_session";

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.user_metadata?.display_name || user.user_metadata?.name || "",
    email: user.email,
    createdAt: user.created_at,
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
  if (!hasSupabaseConfig) return getUser();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    cacheUser(null);
    return null;
  }
  const user = normalizeUser(data.user);
  cacheUser(user);
  return user;
}

export function subscribeToAuth(callback) {
  if (!hasSupabaseConfig) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = normalizeUser(session?.user);
    cacheUser(user);
    callback(user);
  });
  return () => data.subscription.unsubscribe();
}

export async function signUp({ displayName, email, password }) {
  if (!hasSupabaseConfig) {
    const profile = {
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      password,
      createdAt: Date.now(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(SESSION_KEY, "1");
    return { ok: true, user: profile };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName.trim() },
    },
  });

  if (error) return { ok: false, error: error.message };
  const user = normalizeUser(data.user);
  if (user) cacheUser(user);
  return { ok: true, user, needsEmailConfirmation: !data.session };
}

export async function logIn({ email, password }) {
  if (!hasSupabaseConfig) {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return { ok: false, error: "No account on this device yet. Sign up first." };
      const p = JSON.parse(raw);
      if (p.email !== email.trim().toLowerCase()) {
        return { ok: false, error: "Email does not match this account." };
      }
      if (p.password && p.password !== password) {
        return { ok: false, error: "Incorrect password." };
      }
      localStorage.setItem(SESSION_KEY, "1");
      return { ok: true };
    } catch {
      return { ok: false, error: "Something went wrong." };
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  cacheUser(normalizeUser(data.user));
  return { ok: true };
}

export async function logOut() {
  if (hasSupabaseConfig) await supabase.auth.signOut();
  cacheUser(null);
}
