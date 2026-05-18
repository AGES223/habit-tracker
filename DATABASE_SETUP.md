# Database setup

This app is wired for Supabase Auth + Postgres through the local Node server.
Supabase keys are read by `server.js` and are no longer bundled into the browser app.

## 1. Create a Supabase project

Create a project in Supabase, then copy:

- Project URL
- Publishable key or anon key

## 2. Add server environment variables

Copy `.env.example` to `.env.local` or configure these variables in your hosting provider:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
PORT=4000
```

Do not prefix these values with `REACT_APP_`. Create React App exposes `REACT_APP_*`
values to the browser bundle.

## 3. Create the tables

Open the Supabase SQL editor and run `supabase/schema.sql`.

The schema enables row-level security on both app tables. Each authenticated user can only read,
create, update, or delete their own habits and habit completions.

This app does not create or query a `public.profiles` table. Signup display names are stored in
Supabase Auth user metadata, and per-user habit data is stored in `public.habits` and
`public.habit_completions`.

## 4. Run the app

For development, run the API server and React dev server in separate terminals:

```bash
npm run server
npm start
```

The React dev server proxies `/api/*` requests to `http://localhost:4000`.

For production, build the frontend and serve it through the Node server:

```bash
npm run build
npm run serve
```

## 5. Auth behavior

When the server has Supabase env vars, sign up and login use Supabase Auth through `/api/auth/*`.
The browser receives HttpOnly session cookies and never sees the Supabase API key. Without server
env vars, the app keeps using local browser storage so local development still works.
