const http = require("http");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const splitAt = trimmed.indexOf("=");
    if (splitAt === -1) continue;
    const name = trimmed.slice(0, splitAt).trim();
    const rawValue = trimmed.slice(splitAt + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[name]) process.env[name] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const PORT = Number(process.env.PORT || 4000);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

function createSupabase(accessToken) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const splitAt = cookie.indexOf("=");
        return [
          decodeURIComponent(cookie.slice(0, splitAt)),
          decodeURIComponent(cookie.slice(splitAt + 1)),
        ];
      })
  );
}

function cookie(name, value, options = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function clearAuthCookies(res) {
  res.setHeader("Set-Cookie", [
    cookie("ht_access_token", "", { maxAge: 0 }),
    cookie("ht_refresh_token", "", { maxAge: 0 }),
  ]);
}

function setAuthCookies(req, res, session) {
  if (!session?.access_token || !session?.refresh_token) return;
  const secure = req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", [
    cookie("ht_access_token", session.access_token, {
      maxAge: Number(session.expires_in || 3600),
      secure,
    }),
    cookie("ht_refresh_token", session.refresh_token, {
      maxAge: 60 * 60 * 24 * 30,
      secure,
    }),
  ]);
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.user_metadata?.display_name || user.user_metadata?.name || "",
    email: user.email,
    createdAt: user.created_at,
  };
}

async function normalizeUserWithProfile(client, user) {
  const normalized = normalizeUser(user);
  if (!normalized) return null;

  const { data } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.display_name) normalized.displayName = data.display_name;
  return normalized;
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

async function getAuthenticatedClient(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies.ht_access_token;
  const refreshToken = cookies.ht_refresh_token;

  if (accessToken) {
    const client = createSupabase(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (!error && data?.user) return { client, user: data.user };
  }

  if (refreshToken) {
    const client = createSupabase();
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data?.session?.access_token && data?.user) {
      setAuthCookies(req, res, data.session);
      return { client: createSupabase(data.session.access_token), user: data.user };
    }
  }

  return null;
}

function completionRowsToMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [`${row.habit_id}_${new Date(row.completed_on).toDateString()}`, true])
  );
}

function mapToCompletionRows(completions, userId) {
  return Object.keys(completions)
    .filter((key) => completions[key])
    .map((key) => {
      const splitAt = key.indexOf("_");
      return {
        user_id: userId,
        habit_id: Number(key.slice(0, splitAt)),
        completed_on: new Date(key.slice(splitAt + 1)).toISOString().slice(0, 10),
      };
    });
}

async function getCloudValue(client, key) {
  if (key === "ht_habits") {
    const { data, error } = await client
      .from("habits")
      .select("id,name,color,category,note,weekdays_only,created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const habits = data.map((row) => ({
      id: Number(row.id),
      name: row.name,
      color: row.color,
      category: row.category,
      note: row.note || "",
      weekdaysOnly: row.weekdays_only,
    }));
    return JSON.stringify(habits);
  }

  if (key === "ht_completions") {
    const { data, error } = await client
      .from("habit_completions")
      .select("habit_id,completed_on")
      .order("completed_on", { ascending: true });
    if (error) throw error;
    return JSON.stringify(completionRowsToMap(data));
  }

  return null;
}

async function setCloudValue(client, userId, key, value) {
  if (key === "ht_habits") {
    const habits = JSON.parse(value || "[]");
    const ids = habits.map((habit) => Number(habit.id));
    const rows = habits.map((habit) => ({
      id: Number(habit.id),
      user_id: userId,
      name: habit.name,
      color: habit.color,
      category: habit.category,
      note: habit.note || "",
      weekdays_only: Boolean(habit.weekdaysOnly),
    }));

    if (rows.length) {
      const { error } = await client.from("habits").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }

    const deleteQuery = client.from("habits").delete().eq("user_id", userId);
    const { error } = ids.length
      ? await deleteQuery.not("id", "in", `(${ids.join(",")})`)
      : await deleteQuery;
    if (error) throw error;
    return;
  }

  if (key === "ht_completions") {
    const completions = JSON.parse(value || "{}");
    const rows = mapToCompletionRows(completions, userId);
    const { error: deleteError } = await client
      .from("habit_completions")
      .delete()
      .eq("user_id", userId);
    if (deleteError) throw deleteError;

    if (rows.length) {
      const { error } = await client
        .from("habit_completions")
        .upsert(rows, { onConflict: "user_id,habit_id,completed_on" });
      if (error) throw error;
    }
    return;
  }

  throw new Error("Unknown storage key.");
}

async function handleApi(req, res, pathname) {
  if (!hasSupabaseConfig) {
    if (pathname === "/api/health") return sendJson(res, 200, { configured: false });
    return sendJson(res, 503, { error: "Supabase server configuration is missing." });
  }

  if (pathname === "/api/health") return sendJson(res, 200, { configured: true });

  try {
    if (pathname === "/api/auth/signup" && req.method === "POST") {
      const { displayName = "", email = "", password = "" } = await readJson(req);
      const { data, error } = await createSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (error) return sendJson(res, 400, { error: error.message });
      setAuthCookies(req, res, data.session);
      const user = data.session
        ? await normalizeUserWithProfile(createSupabase(data.session.access_token), data.user)
        : normalizeUser(data.user);
      return sendJson(res, 200, {
        user,
        needsEmailConfirmation: !data.session,
      });
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const { email = "", password = "" } = await readJson(req);
      const { data, error } = await createSupabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) return sendJson(res, 400, { error: error.message });
      setAuthCookies(req, res, data.session);
      const user = await normalizeUserWithProfile(createSupabase(data.session.access_token), data.user);
      return sendJson(res, 200, { user });
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      const auth = await getAuthenticatedClient(req, res);
      if (auth) await auth.client.auth.signOut();
      clearAuthCookies(res);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/auth/user" && req.method === "GET") {
      const auth = await getAuthenticatedClient(req, res);
      if (!auth) return sendJson(res, 401, { error: "Not signed in." });
      return sendJson(res, 200, { user: await normalizeUserWithProfile(auth.client, auth.user) });
    }

    const storageMatch = pathname.match(/^\/api\/storage\/([^/]+)$/);
    if (storageMatch) {
      const key = decodeURIComponent(storageMatch[1]);
      const auth = await getAuthenticatedClient(req, res);
      if (!auth) return sendJson(res, 401, { error: "Not signed in." });

      if (req.method === "GET") {
        const value = await getCloudValue(auth.client, key);
        if (value === null) return sendJson(res, 404, { error: "Unknown storage key." });
        return sendJson(res, 200, { value });
      }

      if (req.method === "PUT") {
        const { value = "" } = await readJson(req);
        await setCloudValue(auth.client, auth.user.id, key, value);
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error." });
  }
}

function serveStatic(req, res, pathname) {
  const buildDir = path.join(__dirname, "build");
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(buildDir, requestedPath));
  const safeBuildDir = path.normalize(buildDir + path.sep);
  const fallbackPath = path.join(buildDir, "index.html");

  if (!filePath.startsWith(safeBuildDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : fallbackPath;
  if (!fs.existsSync(finalPath)) {
    res.writeHead(404);
    res.end("Build not found. Run npm run build first, or use npm start for React development.");
    return;
  }

  const ext = path.extname(finalPath);
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(finalPath).pipe(res);
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname);
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Habit Tracker server listening on http://localhost:${PORT}`);
});
