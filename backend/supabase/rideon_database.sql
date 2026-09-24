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

create function rideon_private.local_date()
returns date language sql stable set search_path = '' as $$
  select (current_timestamp at time zone 'Asia/Kolkata')::date;
$$;

create function rideon_private.has_conflict(id text, pickup date, return_date date)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from rideon_private.bookings b where b.bike_id = $1
      and b.status in ('pending', 'confirmed', 'in_progress')
      and daterange(b.pickup, b.return_date, '[)') && daterange($2, $3, '[)')
  );
$$;

create function rideon_private.dispatch(operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_id uuid := auth.uid();
  current_email text := auth.jwt()->>'email';
  profile rideon_private.profiles;
  bike rideon_private.bikes;
  booking rideon_private.bookings;
  bike_id_arg text := coalesce(payload->>'bikeId', payload->>'id');
  pickup_arg date;
  return_arg date;
  city_arg text := nullif(btrim(payload->>'city'), '');
  request_arg uuid;
  phone_arg text;
  rider_arg text;
  next_status text;
  data_arg jsonb;
  photo jsonb;
  photo_bytes bytea;
  photo_mime text;
  cities_arg text[];
  price_arg integer;
  public_flag boolean;
  administrative boolean;
  results jsonb;
begin
  if operation = 'image' then
    select * into bike from rideon_private.bikes b where b.id = bike_id_arg and b.image_bytes is not null;
    if not found then raise sqlstate 'PT404' using message = 'Image not found.'; end if;
    return jsonb_build_object('mime', bike.image_mime, 'data', encode(bike.image_bytes, 'base64'));
  end if;

  if operation in ('catalog', 'quote', 'book') then
    pickup_arg := nullif(payload->>'pickup', '')::date;
    return_arg := nullif(payload->>'returnDate', '')::date;
    if (pickup_arg is null) <> (return_arg is null) or
       (pickup_arg is not null and (pickup_arg < rideon_private.local_date() or return_arg <= pickup_arg)) or
       (operation <> 'catalog' and (pickup_arg is null or city_arg is null)) then
      raise sqlstate 'PT400' using message = 'Choose valid pickup and return dates and a pickup city.';
    end if;
  end if;

  if operation = 'catalog' then
    select jsonb_agg(rideon_private.bike_json(b, false) order by b.position) into results
    from rideon_private.bikes b
    where b.active
      and (city_arg is null or exists (select 1 from unnest(b.cities) c where lower(c) = lower(city_arg)))
      and (pickup_arg is null or not rideon_private.has_conflict(b.id, pickup_arg, return_arg));
    return coalesce(results, '[]');
  end if;

  if operation = 'quote' then
    select * into bike from rideon_private.bikes b where b.id = bike_id_arg and b.active;
    if not found then raise sqlstate 'PT404' using message = 'This bike is no longer available for booking.'; end if;
    if not exists (select 1 from unnest(bike.cities) c where lower(c) = lower(city_arg)) then
      raise sqlstate 'PT400' using message = 'Choose a pickup city offered for this bike.';
    end if;
    if rideon_private.has_conflict(bike.id, pickup_arg, return_arg) then
      raise sqlstate 'PT409' using message = 'This bike is unavailable for those dates.';
    end if;
    return jsonb_build_object('days', return_arg - pickup_arg, 'dailyRate', bike.price,
      'total', (return_arg - pickup_arg)::bigint * bike.price);
  end if;

  raise sqlstate 'PT404' using message = 'Database operation not found.';
end;
$$;
