# RIDEON

RIDEON is a frontend motorcycle and scooter rental demo built with React, TypeScript, Vite, Tailwind CSS, React Router, Motion, and Lucide React.

## Run locally

Use Node.js 24 LTS and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite, typically [http://localhost:5173](http://localhost:5173).

```sh
pnpm typecheck
pnpm build
pnpm preview
```

The production build is written to `dist/`. Static hosting should serve `index.html` for application routes such as `/bikes/classic-350` and `/booking/classic-350`.

## Demo experience

- Browse motorcycles and scooters by category and search by city, dates, model, or brand. Filter by daily rate, engine size, or transmission and sort by price or name.
- Compare up to three bikes and save favorites on the current device. Favorites use browser local storage. Other form entries stay in the current page.
- View model details and choose a pickup city and dates. The estimate multiplies the daily rate by the number of calendar days between pickup and return. Demo availability includes short service windows.
- Review the trip and try the booking and contact forms with sample information. Sign-in, newsletter, terms, privacy, and social controls have demo feedback.
- The homepage, fleet, bike details, booking preview, About, and Contact pages support desktop and mobile layouts.

Fleet records are in `src/data/fleet.ts`. Core date handling, pricing helpers, and demo availability are in `src/utils/rental.ts`. Shared UI lives in `src/components/` and routes in `src/pages/`.

## Visual assets

The optimized WebP imagery in `public/images/` was created with the built-in ImageGen tool. Model images are illustrative, and the detail gallery uses crops of each bike illustration. The generation prompts covered:

- A widescreen editorial hero photograph of a rider on a black and brushed-silver roadster in the Indian Himalayas, with the rider at right and a charcoal mountain shadow at left.
- Consistent three-quarter studio views of the eight sample bike models and a spare scrambler, each framed separately on a warm gray backdrop.
- Five editorial category scenes featuring a sport bike, cruiser, scooter, adventure bike, and commuter bike in distinct environments.
- A winding Himalayan road with a solo rider heading into the distance, with dark open space at the left for campaign copy.

## Backend phase

Deferred work includes account authentication, real inventory and availability, reservations, payment and deposit processing, rental policy and document verification, and delivery of contact messages or newsletter subscriptions.
