# RIDEON

RIDEON is a two-sided motorcycle and scooter rental marketplace. Riders request available bikes, and independent hosts publish listings and manage their own rentals. One account can do both.

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

The migrations in `backend/supabase/migrations/` create a private Postgres schema and seed eight RIDEON-managed listings. Postgres checks that a booking belongs to the current rider or host as appropriate. It prevents overlapping reservations and checks host calendar blocks before accepting a request. Each reservation records the price and provider at submission.

Riders sign up and sign in through Supabase Auth. If email confirmation is enabled, the rider opens the confirmation email and signs in afterward. Set your Site URL and allowed redirect URLs in Supabase Authentication settings. To use a specific confirmation landing page, set `SUPABASE_EMAIL_REDIRECT` in the backend environment to an allowed URL such as `http://127.0.0.1:5173/sign-in`.

### Rent a bike

Browse the [marketplace](http://127.0.0.1:5173/bikes), select a pickup city and dates, and submit a rental request. Check **My Bookings** for the host’s response. Private pickup instructions appear there after confirmation.

### Host your bikes

1. Open [List your bike](http://127.0.0.1:5173/host). Sign in with your existing rider account or choose **Create a host account** and confirm your email.
2. Set your public store name and introduction. Choose **Start hosting**.
3. Under **Listings**, add bikes, photos, pickup cities, rates, and optional pickup instructions. Publish the listing to show it on your storefront.
4. Use **Availability** on a listing to block personal or maintenance dates. Use **Requests** to confirm bookings and record pickup and return. Rider contact details are available to the host after confirmation.

### Marketplace staff

Staff can review the catalog and reservations across hosts. To grant this separate permission, have the administrator register and confirm their email first. As the Supabase project owner, run the following in the SQL Editor with that account’s email address.

```sql
insert into rideon_private.profiles (user_id, name, role)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'name'), ''), 'Administrator'), 100), 'admin'
from auth.users
where lower(email) = lower('replace-with-admin-email@example.com')
  and email_confirmed_at is not null
on conflict (user_id) do update set role = 'admin'
returning user_id, role;
```

Sign in at [the staff portal](http://127.0.0.1:5173/admin) to use these marketplace-wide controls.

The previous SQLite database is not read by this version. Existing SQLite accounts, if any, must register in Supabase Auth. No local SQLite file was present in the workspace at the time of migration.

## Build and test

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

The built website is served by Express at [http://127.0.0.1:4173](http://127.0.0.1:4173). Serve the frontend and `/api` under the same public origin. For an HTTPS reverse proxy, set `RIDEON_ORIGIN` to that public origin to enforce same-origin requests and Secure session cookies.

`pnpm test` checks the Express routes with an isolated Supabase gateway double. The rollback-only SQL tests in `backend/tests/` exercise Postgres booking conflicts, host isolation, public storefronts, availability blocks, and contact privacy.
