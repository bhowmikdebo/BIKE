create schema rideon_private;
create extension if not exists btree_gist with schema extensions;

create table rideon_private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  role text not null default 'customer' check (role in ('customer', 'admin'))
);

create table rideon_private.bikes (
  id text primary key check (id ~ '^[a-z0-9-]{1,90}$'),
  position bigint generated always as identity,
  active boolean not null default true,
  price integer not null check (price between 1 and 1000000),
  cities text[] not null check (cardinality(cities) between 1 and 20),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  image_mime text check (image_mime in ('image/jpeg', 'image/png', 'image/webp')),
  image_bytes bytea check (octet_length(image_bytes) between 16 and 2097152),
  check ((image_bytes is null) = (image_mime is null))
);

create table rideon_private.bookings (
  id text primary key default ('RD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  user_id uuid not null references rideon_private.profiles(user_id),
  bike_id text not null references rideon_private.bikes(id),
  bike_name text not null,
  rider_name text not null check (length(rider_name) between 1 and 100),
  rider_email text not null,
  phone text not null check (length(phone) between 10 and 25),
  city text not null,
  pickup date not null,
  return_date date not null check (return_date > pickup),
  days integer generated always as (return_date - pickup) stored,
  daily_rate integer not null check (daily_rate between 1 and 1000000),
  total bigint generated always as ((return_date - pickup)::bigint * daily_rate) stored,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  request_key uuid not null,
  unique (user_id, request_key),
  exclude using gist (bike_id with =, daterange(pickup, return_date, '[)') with &&)
    where (status in ('pending', 'confirmed', 'in_progress'))
);
create index rideon_bookings_bike_idx on rideon_private.bookings (bike_id);
create index rideon_bookings_customer_created_idx on rideon_private.bookings (user_id, created_at desc);
create index rideon_bookings_created_idx on rideon_private.bookings (created_at desc);

alter table rideon_private.profiles enable row level security;
alter table rideon_private.bikes enable row level security;
alter table rideon_private.bookings enable row level security;

create function rideon_private.bike_json(b rideon_private.bikes, administrative boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select b.data || jsonb_build_object('id', b.id, 'price', b.price, 'cities', b.cities) ||
    case when administrative then jsonb_build_object('active', b.active, 'hasUploadedImage', b.image_bytes is not null)
         when b.image_bytes is not null then jsonb_build_object('imageUrl', '/api/bikes/' || b.id || '/image')
         else '{}'::jsonb end;
$$;

create function rideon_private.booking_json(b rideon_private.bookings)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'bikeId', b.bike_id, 'bikeName', b.bike_name, 'riderName', b.rider_name,
    'riderEmail', b.rider_email, 'phone', b.phone, 'city', b.city, 'pickup', b.pickup,
    'returnDate', b.return_date, 'days', b.days, 'dailyRate', b.daily_rate, 'total', b.total,
    'status', b.status, 'createdAt', b.created_at
  );
$$;
