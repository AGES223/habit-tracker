# Habit Tracker

A React habit tracker backed by Supabase Auth + Postgres through a small Node API server.

## Development

Create `.env.local` from `.env.example`, then run the API and frontend in separate terminals:

```bash
npm run server
npm start
```

Open [http://localhost:3000](http://localhost:3000). The React dev server proxies `/api/*`
requests to `http://localhost:4000`.

## Production

Build the React app and serve the static files plus API from the Node server:

```bash
npm run build
npm run serve
```

Open [http://localhost:4000](http://localhost:4000).

## Environment

Supabase values belong on the server:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
PORT=4000
```

Do not use `REACT_APP_` for Supabase keys. Create React App embeds `REACT_APP_*`
variables in the browser bundle.

## Database

Run `supabase/schema.sql` in the Supabase SQL editor. See `DATABASE_SETUP.md` for the full setup.

## Scripts

- `npm start`: start the React dev server.
- `npm run server`: start the local API server.
- `npm run build`: create a production build.
- `npm run serve`: serve the production build and API from Node.
- `npm test`: run the test watcher.
