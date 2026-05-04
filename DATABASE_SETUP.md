# Database setup

This app is wired for Supabase Auth + Postgres.

## 1. Create a Supabase project

Create a project in Supabase, then copy:

- Project URL
- Publishable key or anon key

## 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Restart `npm start` after changing env vars.

## 3. Create the tables

Open the Supabase SQL editor and run `supabase/schema.sql`.

The schema enables row-level security on both app tables. Each authenticated user can only read,
create, update, or delete their own habits and habit completions.

## 4. Auth behavior

When Supabase env vars are present, sign up and login use Supabase Auth. Without env vars, the app
keeps using local browser storage so local development still works.

