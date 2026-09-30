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

## Database and accounts

The Supabase migration in `backend/supabase/migrations/` creates a private Postgres schema and seeds eight fleet listings. Reservations store the rider’s own booking history and the rate at submission. Postgres prevents overlapping active rentals for the same bike, and role checks restrict administrative actions. The migration is already applied to the connected project.

Riders sign up and sign in through Supabase Auth. If email confirmation is enabled, the rider opens the confirmation email and signs in afterward. Set your Site URL and allowed redirect URLs in Supabase Authentication settings. To use a specific confirmation landing page, set `SUPABASE_EMAIL_REDIRECT` in the backend environment to an allowed URL such as `http://127.0.0.1:5173/sign-in`.

To grant administrator access, have the administrator register and confirm their email first. As the Supabase project owner, run the following in the SQL Editor with that account’s email address.

```sql
insert into rideon_private.profiles (user_id, name, role)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'name'), ''), 'Administrator'), 100), 'admin'
from auth.users
where lower(email) = lower('replace-with-admin-email@example.com')
  and email_confirmed_at is not null
on conflict (user_id) do update set role = 'admin'
returning user_id, role;
```

Sign in at [the admin portal](http://127.0.0.1:5173/admin). Use **Fleet** to add, edit, publish, or archive bikes and upload photos. Use **Bookings** to confirm requests and record pickup and return. Riders can request available bikes and view or cancel eligible reservations under **My Bookings**.

The previous SQLite database is not read by this version. Existing SQLite accounts, if any, must register in Supabase Auth. No local SQLite file was present in the workspace at the time of migration.

## Build and test

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

The built website is served by Express at [http://127.0.0.1:4173](http://127.0.0.1:4173). Serve the frontend and `/api` under the same public origin. For an HTTPS reverse proxy, set `RIDEON_ORIGIN` to that public origin to enforce same-origin requests and Secure session cookies.

`pnpm test` checks the Express routes with an isolated Supabase gateway double. The rollback-only SQL test in `backend/tests/database-smoke.sql` exercises real Postgres permissions, quote calculation, booking conflicts, and cancellation.
