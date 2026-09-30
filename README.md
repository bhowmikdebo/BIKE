# RIDEON

RIDEON is a motorcycle and scooter rental site with a rider booking portal and a fleet administration portal.

- `frontend/` contains the React and TypeScript site, Vite configuration, and image assets.
- `backend/` contains the Node.js and Express API, Supabase integration, and database migrations.
- `shared/` contains the cross-app types, rental date rules, and fleet seed data.

## Run locally

Use Node.js 24.15 or newer and pnpm 11.

```sh
pnpm install --frozen-lockfile
cp -n backend/.env.example backend/.env
pnpm dev
```

The workspace uses the Supabase project [bhowmikdebo’s Project](https://supabase.com/dashboard/project/ejlzogpbapsjboxmziej). The local `backend/.env` is Git-ignored. On a fresh checkout, fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the project’s **Connect** panel or **Settings → API Keys**. Supabase Auth and database access use the publishable key with the signed-in rider’s session. RIDEON does not require a service-role key.

Open [the website](http://127.0.0.1:5173). The root development command runs Vite and Express together. You can also run `pnpm --filter @rideon/backend dev` and `pnpm --filter @rideon/frontend dev` in separate terminals. Vite forwards `/api` to Express at `127.0.0.1:4173`.
