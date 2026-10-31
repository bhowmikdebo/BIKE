# RIDEON

RIDEON is a motorcycle and scooter rental website with a customer booking portal and an admin portal. It uses React, TypeScript, Vite, Tailwind CSS, and a Node.js API backed by a local SQLite database. The first run loads the eight original fleet listings.

## Run locally

Use Node.js 24.15 or newer and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [the RIDEON site](http://127.0.0.1:5173). The dev command starts Vite and the API together. SQLite saves accounts, uploaded images, fleet changes, and reservations in `.rideon/rideon.sqlite`. The database directory is Git-ignored.

For a built copy served by Node, stop the dev server first.

```sh
pnpm build
pnpm start
```

Open [the built site](http://127.0.0.1:4173). Copy `.env.example` to `.env` to change the port, database location, or public HTTPS origin. The server binds to loopback. For HTTPS via a reverse proxy, set `RIDEON_ORIGIN` to the public origin so that session cookies use the Secure attribute.

## Create an administrator

Run the following in an interactive terminal using the same database as the website.

```sh
pnpm admin:create
```

Enter an email, display name, and a password of at least 12 characters. The password prompt hides input. Open [the admin portal](http://127.0.0.1:5173/admin) and sign in with those credentials. Public signup creates rider accounts only.

In the **Fleet** tab, admins can add or edit bikes, rates, pickup cities, specs, and photos. Archiving removes a bike from the public catalog while preserving its existing reservations. Publish it again from the same tab. Each fleet listing represents one bookable bike, even if it is offered in multiple pickup cities.

In the **Bookings** tab, admins can confirm or cancel a request, mark a confirmed bike as picked up on or after the scheduled date, and record its return.

## Rider booking flow

1. Browse available bikes by pickup city and dates. Open a bike and review its rate.
2. Sign in or create a rider account, then submit the rider’s name and phone number.
3. Open **My Bookings** to view the reservation reference, pickup details, price, and status. Riders can cancel pending or confirmed requests through the pickup date.

The server validates date ranges and prices when a booking is submitted. Pending, confirmed, and picked-up reservations reserve the selected dates. A return date is exclusive, so a second rental can start that day. Each booking retains the daily rate and bike name recorded at submission. Requests await administrator confirmation. The portal provides the confirmation status.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
```

The API test uses an isolated database. It checks admin authorization, rider signup, image persistence, conflicting reservations, cancellation, and status changes.

## Data and integrations

The SQLite schema and transactional data access live in `server/`. The browser uses JSON endpoints under `/api`, so storage and authentication can be replaced when the Supabase requirements are available. No Supabase account or credentials are needed for this version.

Payments, password recovery, email or SMS delivery, and the contact and newsletter integrations are outside this phase. The catalog starts with illustrative ImageGen assets in `public/images/` and supports administrator-supplied photos.
