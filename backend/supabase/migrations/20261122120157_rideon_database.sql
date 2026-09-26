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

  if current_id is null or current_email is null then
    raise sqlstate 'PT401' using message = 'Sign in to continue.';
  end if;

  select * into profile from rideon_private.profiles p where p.user_id = current_id;
  if not found then
    insert into rideon_private.profiles (user_id, name)
    values (current_id, left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'name'), ''), 'Rider'), 100))
    on conflict (user_id) do nothing;
    select * into strict profile from rideon_private.profiles p where p.user_id = current_id;
  end if;
  administrative := profile.role = 'admin';
  if operation = 'account' then
    return jsonb_build_object('id', current_id, 'name', profile.name, 'email', current_email, 'role', profile.role);
  end if;

  if operation in ('fleet', 'saveBike', 'publish') and not administrative then
    raise sqlstate 'PT403' using message = 'Administrator access is required.';
  end if;

  if operation = 'fleet' then
    select jsonb_agg(rideon_private.bike_json(b, true) order by b.position desc) into results
    from rideon_private.bikes b;
    return coalesce(results, '[]');
  end if;

  if operation = 'publish' then
    if jsonb_typeof(payload->'active') is distinct from 'boolean' then
      raise sqlstate 'PT400' using message = 'Select a publication status.';
    end if;
    update rideon_private.bikes b set active = (payload->>'active')::boolean
    where b.id = bike_id_arg returning * into bike;
    if not found then raise sqlstate 'PT404' using message = 'Bike not found.'; end if;
    return rideon_private.bike_json(bike, true);
  end if;

  if operation = 'saveBike' then
    data_arg := payload->'data';
    if jsonb_typeof(data_arg) is distinct from 'object'
       or jsonb_typeof(data_arg->'cities') is distinct from 'array'
       or jsonb_typeof(data_arg->'active') is distinct from 'boolean'
       or coalesce(length(btrim(data_arg->>'brand')), 0) not between 1 and 80
       or coalesce(length(btrim(data_arg->>'model')), 0) not between 1 and 80
       or coalesce(data_arg->>'category', '') not in ('Sports Bikes', 'Cruisers', 'Scooters', 'Adventure Bikes', 'Commuter Bikes')
       or coalesce(data_arg->>'transmission', '') not in ('Manual', 'Automatic')
       or coalesce(data_arg->>'imageUrl', '') !~ '^(https://[^[:space:]]+|/images/[a-z0-9-]+\.webp)?$' then
      raise sqlstate 'PT400' using message = 'Check the fleet listing fields.';
    end if;
    cities_arg := array(select distinct btrim(c) from jsonb_array_elements_text(data_arg->'cities') c where length(btrim(c)) between 1 and 90);
    price_arg := (data_arg->>'price')::integer;
    public_flag := (data_arg->>'active')::boolean;
    photo := data_arg->'image';
    data_arg := data_arg - array['id', 'price', 'cities', 'active', 'image', 'hasUploadedImage'];
    if jsonb_typeof(photo) = 'object' then
      photo_mime := photo->>'mime';
      if coalesce(photo_mime, '') not in ('image/jpeg', 'image/png', 'image/webp') or
         coalesce(length(photo->>'data'), 0) not between 1 and 2796204 then
        raise sqlstate 'PT400' using message = 'Upload a JPG, PNG or WebP image under 2 MB.';
      end if;
      photo_bytes := decode(photo->>'data', 'base64');
    end if;
    if bike_id_arg is null then
      bike_id_arg := 'bike-' || gen_random_uuid()::text;
      insert into rideon_private.bikes (id, data, price, cities, active, image_mime, image_bytes)
      values (bike_id_arg, data_arg, price_arg, cities_arg, public_flag, photo_mime, photo_bytes)
      returning * into bike;
    else
      update rideon_private.bikes b set data = data_arg, price = price_arg, cities = cities_arg, active = public_flag,
        image_mime = case when photo is null then b.image_mime else photo_mime end,
        image_bytes = case when photo is null then b.image_bytes else photo_bytes end
      where b.id = bike_id_arg returning * into bike;
      if not found then raise sqlstate 'PT404' using message = 'Bike not found.'; end if;
    end if;
    return rideon_private.bike_json(bike, true);
  end if;

  if operation = 'bookings' then
    if payload->'admin' = 'true'::jsonb and not administrative then
      raise sqlstate 'PT403' using message = 'Administrator access is required.';
    end if;
    select jsonb_agg(rideon_private.booking_json(b) order by b.created_at desc) into results
    from rideon_private.bookings b where b.user_id = current_id or (administrative and payload->'admin' = 'true'::jsonb);
    return coalesce(results, '[]');
  end if;

  if operation = 'book' then
    if administrative then raise sqlstate 'PT403' using message = 'Use a rider account to book.'; end if;
    phone_arg := btrim(payload->>'phone');
    rider_arg := btrim(payload->>'riderName');
    if payload->'agreement' is distinct from 'true'::jsonb or
       coalesce(phone_arg, '') !~ '^[+()0-9 .-]{10,25}$' or
       length(regexp_replace(phone_arg, '[^0-9]', '', 'g')) not between 10 and 15 or
       coalesce(length(rider_arg), 0) not between 1 and 100 or
       coalesce(payload->>'requestKey', '') !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
      raise sqlstate 'PT400' using message = 'Check rider details and acknowledge the booking request.';
    end if;
    request_arg := (payload->>'requestKey')::uuid;
    price_arg := (payload->>'dailyRate')::integer;
    perform pg_advisory_xact_lock(hashtextextended(current_id::text || request_arg::text, 0));
    select * into booking from rideon_private.bookings b where b.user_id = current_id and b.request_key = request_arg;
    if found then
      if booking.bike_id = bike_id_arg and booking.pickup = pickup_arg and booking.return_date = return_arg and
         lower(booking.city) = lower(city_arg) and booking.daily_rate = price_arg and booking.rider_name = rider_arg and booking.phone = phone_arg then
        return rideon_private.booking_json(booking);
      end if;
      raise sqlstate 'PT409' using message = 'This booking request was already used for another reservation.';
    end if;
    select * into bike from rideon_private.bikes b where b.id = bike_id_arg and b.active for update;
    if not found then raise sqlstate 'PT404' using message = 'This bike is no longer available for booking.'; end if;
    if price_arg is distinct from bike.price then raise sqlstate 'PT409' using message = 'The daily rate changed. Review the latest quote before booking.'; end if;
    select c into city_arg from unnest(bike.cities) c where lower(c) = lower(city_arg) limit 1;
    if not found then raise sqlstate 'PT400' using message = 'Choose a pickup city offered for this bike.'; end if;
    insert into rideon_private.bookings (user_id, request_key, bike_id, bike_name, rider_name, rider_email, phone, city, pickup, return_date, daily_rate)
    values (current_id, request_arg, bike.id, (bike.data->>'brand') || ' ' || (bike.data->>'model'), rider_arg, current_email, phone_arg, city_arg, pickup_arg, return_arg, bike.price)
    returning * into booking;
    return rideon_private.booking_json(booking);
  end if;

  if operation = 'status' then
    next_status := payload->>'status';
    if coalesce(next_status, '') not in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') then
      raise sqlstate 'PT400' using message = 'Select a valid booking status.';
    end if;
    select * into booking from rideon_private.bookings b
    where b.id = bike_id_arg and (administrative or b.user_id = current_id) for update;
    if not found then raise sqlstate 'PT404' using message = 'Booking not found.'; end if;
    if not administrative and (next_status <> 'cancelled' or booking.pickup < rideon_private.local_date()) then
      raise sqlstate 'PT403' using message = 'This booking can only be changed by an administrator.';
    end if;
    if booking.status = next_status then return rideon_private.booking_json(booking); end if;
    if not ((booking.status = 'pending' and next_status in ('confirmed', 'cancelled'))
         or (booking.status = 'confirmed' and next_status in ('in_progress', 'cancelled'))
         or (booking.status = 'in_progress' and next_status = 'completed')) then
      raise sqlstate 'PT409' using message = 'This status change is unavailable.';
    end if;
    if next_status = 'in_progress' and booking.pickup > rideon_private.local_date() then
      raise sqlstate 'PT409' using message = 'Pickup cannot be recorded before the scheduled day.';
    end if;
    update rideon_private.bookings b set status = next_status where b.id = booking.id returning * into booking;
    return rideon_private.booking_json(booking);
  end if;

  raise sqlstate 'PT404' using message = 'Database operation not found.';
end;
$$;

create function public.rideon_api(operation text, payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select rideon_private.dispatch(operation, payload);
$$;

revoke all on schema rideon_private from public, anon, authenticated;
revoke all on all tables in schema rideon_private from public, anon, authenticated;
revoke all on all functions in schema rideon_private from public, anon, authenticated;
revoke all on function public.rideon_api(text, jsonb) from public, anon, authenticated;
grant usage on schema rideon_private to anon, authenticated;
grant execute on function rideon_private.dispatch(text, jsonb) to anon, authenticated;
grant execute on function public.rideon_api(text, jsonb) to anon, authenticated;

insert into rideon_private.bikes (id, data, price, cities)
select bike->>'id', bike - array['id', 'price', 'cities'], (bike->>'price')::integer,
  array(select jsonb_array_elements_text(bike->'cities'))
from jsonb_array_elements($seed$[
  {
    "id": "classic-350",
    "brand": "Royal Enfield",
    "model": "Classic 350",
    "category": "Cruisers",
    "engine": 349,
    "transmission": "Manual",
    "mileage": 35,
    "price": 899,
    "cities": [
      "Bengaluru",
      "Goa",
      "New Delhi",
      "Jaipur"
    ],
    "description": "A relaxed riding position, a low-slung seat and that familiar single-cylinder beat. The Classic comes into its own on slow mornings and unhurried highway rides.",
    "features": [
      "Upright riding position",
      "Classic round headlight",
      "Dual-channel ABS"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/classic-350.webp"
  },
  {
    "id": "himalayan-450",
    "brand": "Royal Enfield",
    "model": "Himalayan 450",
    "category": "Adventure Bikes",
    "engine": 452,
    "transmission": "Manual",
    "mileage": 30,
    "price": 1499,
    "cities": [
      "Bengaluru",
      "New Delhi",
      "Pune",
      "Jaipur"
    ],
    "description": "Tall, composed and made for long days in the saddle. The Himalayan gives you a commanding view of the road when the route turns to gravel.",
    "features": [
      "Upright adventure ergonomics",
      "Long-travel suspension",
      "Digital instrument cluster"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/himalayan-450.webp"
  },
  {
    "id": "duke-390",
    "brand": "KTM",
    "model": "Duke 390",
    "category": "Sports Bikes",
    "engine": 399,
    "transmission": "Manual",
    "mileage": 27,
    "price": 1399,
    "cities": [
      "Bengaluru",
      "Mumbai",
      "Pune"
    ],
    "description": "A compact street bike with quick steering and a responsive single-cylinder engine. Its light feel makes winding roads the place to spend an afternoon.",
    "features": [
      "Lightweight street chassis",
      "LED lighting",
      "Digital instrument cluster"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/duke-390.webp"
  },
  {
    "id": "activa-6g",
    "brand": "Honda",
    "model": "Activa 6G",
    "category": "Scooters",
    "engine": 110,
    "transmission": "Automatic",
    "mileage": 48,
    "price": 399,
    "cities": [
      "Bengaluru",
      "Goa",
      "Mumbai",
      "New Delhi",
      "Pune",
      "Jaipur"
    ],
    "description": "A compact step-through scooter for quick errands, beach roads and short city trips. The automatic transmission keeps crowded streets simple.",
    "features": [
      "Step-through frame",
      "Under-seat storage",
      "Automatic transmission"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/activa-6g.webp"
  },
  {
    "id": "mt-15",
    "brand": "Yamaha",
    "model": "MT-15",
    "category": "Commuter Bikes",
    "engine": 155,
    "transmission": "Manual",
    "mileage": 45,
    "price": 749,
    "cities": [
      "Bengaluru",
      "Mumbai",
      "New Delhi",
      "Pune"
    ],
    "description": "An agile street bike with a compact footprint and a lively engine. Easy to place in traffic and comfortable for a quick detour out of town.",
    "features": [
      "Compact street ergonomics",
      "LED headlight",
      "Digital instrument cluster"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/mt-15.webp"
  },
  {
    "id": "apache-rtr-200",
    "brand": "TVS",
    "model": "Apache RTR 200",
    "category": "Sports Bikes",
    "engine": 198,
    "transmission": "Manual",
    "mileage": 38,
    "price": 799,
    "cities": [
      "Bengaluru",
      "Mumbai",
      "New Delhi",
      "Pune"
    ],
    "description": "A nimble roadster for everyday routes with enough character for the weekend. The Apache pairs an easy reach to the controls with a sporty riding position.",
    "features": [
      "Sporty roadster ergonomics",
      "LED headlight",
      "Digital instrument cluster"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/apache-rtr-200.webp"
  },
  {
    "id": "dominar-400",
    "brand": "Bajaj",
    "model": "Dominar 400",
    "category": "Cruisers",
    "engine": 373,
    "transmission": "Manual",
    "mileage": 29,
    "price": 1099,
    "cities": [
      "Bengaluru",
      "Goa",
      "Mumbai",
      "Pune"
    ],
    "description": "A substantial touring roadster with a planted feel on longer stretches. Choose it for a weekend with more open road than city traffic.",
    "features": [
      "Touring riding position",
      "LED headlight",
      "Dual-channel ABS"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/dominar-400.webp"
  },
  {
    "id": "hunter-350",
    "brand": "Royal Enfield",
    "model": "Hunter 350",
    "category": "Commuter Bikes",
    "engine": 349,
    "transmission": "Manual",
    "mileage": 36,
    "price": 849,
    "cities": [
      "Bengaluru",
      "Goa",
      "New Delhi",
      "Jaipur"
    ],
    "description": "A compact retro roadster with a low seat and easygoing throttle. It fits weekday city trips and leisurely runs to the outskirts.",
    "features": [
      "Low seat height",
      "Compact roadster frame",
      "Round headlight"
    ],
    "fuel": "Petrol",
    "seats": 2,
    "imageUrl": "/images/hunter-350.webp"
  }
]$seed$::jsonb) bike;
