-- An account may ride and host. The staff role is independent of hosting.
create table rideon_private.hosts (
  user_id uuid primary key references rideon_private.profiles(user_id),
  slug text not null unique check (length(slug) between 1 and 90 and slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) between 1 and 80),
  bio text not null default '' check (length(bio) <= 400)
);

alter table rideon_private.bikes
  add column host_id uuid references rideon_private.hosts(user_id),
  add column pickup_instructions text not null default '' check (length(pickup_instructions) <= 600);
create index rideon_bikes_host_idx on rideon_private.bikes (host_id);

alter table rideon_private.bookings
  add column host_id uuid references rideon_private.hosts(user_id),
  add column host_name text,
  add column pickup_instructions text not null default '' check (length(pickup_instructions) <= 600),
  add check ((host_id is null and host_name is null) or (host_id is not null and host_name is not null));
create index rideon_bookings_host_created_idx on rideon_private.bookings (host_id, created_at desc);

create table rideon_private.bike_blocks (
  id uuid primary key default gen_random_uuid(),
  bike_id text not null references rideon_private.bikes(id),
  pickup date not null,
  return_date date not null check (return_date > pickup),
  exclude using gist (bike_id with =, daterange(pickup, return_date, '[)') with &&)
);

alter table rideon_private.hosts enable row level security;
alter table rideon_private.bike_blocks enable row level security;
revoke all on rideon_private.hosts, rideon_private.bike_blocks from public, anon, authenticated;

create function rideon_private.host_json(h rideon_private.hosts)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('name', h.name, 'slug', h.slug, 'bio', h.bio);
$$;

create function rideon_private.block_json(b rideon_private.bike_blocks)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', b.id, 'pickup', b.pickup, 'returnDate', b.return_date);
$$;

create or replace function rideon_private.bike_json(b rideon_private.bikes, administrative boolean)
returns jsonb language sql stable set search_path = '' as $$
  select b.data || jsonb_build_object('id', b.id, 'price', b.price, 'cities', b.cities,
      'host', (select jsonb_build_object('name', h.name, 'slug', h.slug)
               from rideon_private.hosts h where h.user_id = b.host_id)) ||
    case when administrative then jsonb_build_object('active', b.active, 'hasUploadedImage', b.image_bytes is not null, 'pickupInstructions', b.pickup_instructions)
         when b.image_bytes is not null then jsonb_build_object('imageUrl', '/api/bikes/' || b.id || '/image')
         else '{}'::jsonb end;
$$;

create or replace function rideon_private.booking_json(b rideon_private.bookings)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'bikeId', b.bike_id, 'bikeName', b.bike_name, 'riderName', b.rider_name,
    'riderEmail', b.rider_email, 'phone', b.phone, 'city', b.city, 'pickup', b.pickup,
    'returnDate', b.return_date, 'days', b.days, 'dailyRate', b.daily_rate, 'total', b.total,
    'status', b.status, 'createdAt', b.created_at,
    'host', (select jsonb_build_object('name', b.host_name, 'slug', h.slug)
             from rideon_private.hosts h where h.user_id = b.host_id)
  ) || case when b.status in ('confirmed', 'in_progress') then
    jsonb_build_object('pickupInstructions', b.pickup_instructions) else '{}'::jsonb end;
$$;

create function rideon_private.host_booking_json(b rideon_private.bookings)
returns jsonb language sql stable set search_path = '' as $$
  select case when b.status in ('confirmed', 'in_progress')
    then rideon_private.booking_json(b)
    else rideon_private.booking_json(b) - array['riderEmail', 'phone'] end;
$$;

create or replace function rideon_private.has_conflict(id text, pickup date, return_date date)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from rideon_private.bookings b where b.bike_id = $1
      and b.status in ('pending', 'confirmed', 'in_progress')
      and daterange(b.pickup, b.return_date, '[)') && daterange($2, $3, '[)')
  ) or exists (
    select 1 from rideon_private.bike_blocks b where b.bike_id = $1
      and daterange(b.pickup, b.return_date, '[)') && daterange($2, $3, '[)')
  );
$$;

create or replace function rideon_private.dispatch(operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_id uuid := auth.uid();
  current_email text := auth.jwt()->>'email';
  profile rideon_private.profiles;
  host rideon_private.hosts;
  blocked rideon_private.bike_blocks;
  scope_arg text := coalesce(payload->>'scope', '');
  host_scope boolean := scope_arg = 'host';
  public_name text;
  public_bio text;
  pickup_note text;
  can_manage boolean;
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
  if operation = 'image' and scope_arg = '' then
    select * into bike from rideon_private.bikes b where b.id = bike_id_arg and b.active and b.image_bytes is not null;
    if not found then raise sqlstate 'PT404' using message = 'Image not found.'; end if;
    return jsonb_build_object('mime', bike.image_mime, 'data', encode(bike.image_bytes, 'base64'));
  end if;

  if operation = 'storefront' then
    select * into host from rideon_private.hosts h where h.slug = payload->>'slug';
    if not found then raise sqlstate 'PT404' using message = 'Host not found.'; end if;
    select jsonb_agg(rideon_private.bike_json(b, false) order by b.position desc) into results
    from rideon_private.bikes b where b.host_id = host.user_id and b.active;
    return jsonb_build_object('host', rideon_private.host_json(host), 'bikes', coalesce(results, '[]'));
  end if;

  if operation in ('catalog', 'quote', 'book', 'block') then
    pickup_arg := nullif(payload->>'pickup', '')::date;
    return_arg := nullif(payload->>'returnDate', '')::date;
    if (pickup_arg is null) <> (return_arg is null) or
       (pickup_arg is not null and (pickup_arg < rideon_private.local_date() or return_arg <= pickup_arg)) or
       (operation in ('quote', 'book') and (pickup_arg is null or city_arg is null)) or
       (operation = 'block' and pickup_arg is null) then
      raise sqlstate 'PT400' using message = 'Choose valid pickup and return dates and a pickup city.';
    end if;
  end if;

  if operation = 'catalog' then
    select jsonb_agg(rideon_private.bike_json(b, false) order by b.position desc) into results
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
  select * into host from rideon_private.hosts h where h.user_id = current_id;
  if operation = 'hostProfile' then
    public_name := btrim(payload->>'name');
    public_bio := coalesce(btrim(payload->>'bio'), '');
    if coalesce(length(public_name), 0) not between 1 and 80 or length(public_bio) > 400 then
      raise sqlstate 'PT400' using message = 'Enter a public host name and a short introduction.';
    end if;
    insert into rideon_private.hosts (user_id, slug, name, bio)
    values (current_id,
      coalesce(nullif(trim(both '-' from regexp_replace(left(lower(public_name), 40), '[^a-z0-9]+', '-', 'g')), ''), 'host')
        || '-' || left(replace(gen_random_uuid()::text, '-', ''), 16),
      public_name, public_bio)
    on conflict (user_id) do update set name = excluded.name, bio = excluded.bio
    returning * into host;
  end if;
  if operation in ('account', 'hostProfile') then
    return jsonb_build_object('id', current_id, 'name', profile.name, 'email', current_email, 'role', profile.role,
      'host', case when host.user_id is not null then rideon_private.host_json(host) end);
  end if;

  if host_scope and host.user_id is null then
    raise sqlstate 'PT403' using message = 'Set up your host profile first.';
  end if;
  if operation in ('fleet', 'saveBike', 'publish', 'image') and not (host_scope or administrative) then
    raise sqlstate 'PT403' using message = 'Fleet access is required.';
  end if;

  if operation = 'image' then
    select * into bike from rideon_private.bikes b
    where b.id = bike_id_arg and b.image_bytes is not null and (not host_scope or b.host_id = current_id);
    if not found then raise sqlstate 'PT404' using message = 'Image not found.'; end if;
    return jsonb_build_object('mime', bike.image_mime, 'data', encode(bike.image_bytes, 'base64'));
  end if;

  if operation in ('blocks', 'block', 'unblock') then
    -- Booking requests use the same bike lock before checking calendar availability.
    select * into bike from rideon_private.bikes b where b.id = bike_id_arg and b.host_id = current_id for update;
    if not found then raise sqlstate 'PT404' using message = 'Bike not found.'; end if;
    if operation = 'blocks' then
      select jsonb_agg(rideon_private.block_json(a) order by a.pickup) into results
      from rideon_private.bike_blocks a where a.bike_id = bike.id and a.return_date > rideon_private.local_date();
      return coalesce(results, '[]');
    elsif operation = 'block' then
      if rideon_private.has_conflict(bike.id, pickup_arg, return_arg) then
        raise sqlstate 'PT409' using message = 'These dates overlap a booking or another blocked period.';
      end if;
      insert into rideon_private.bike_blocks (bike_id, pickup, return_date)
      values (bike.id, pickup_arg, return_arg) returning * into blocked;
      return rideon_private.block_json(blocked);
    end if;
    delete from rideon_private.bike_blocks a where a.bike_id = bike.id and a.id::text = payload->>'blockId';
    if not found then raise sqlstate 'PT404' using message = 'Blocked dates not found.'; end if;
    return null;
  end if;

  if operation = 'fleet' then
    select jsonb_agg(rideon_private.bike_json(b, true) order by b.position desc) into results
    from rideon_private.bikes b where not host_scope or b.host_id = current_id;
    return coalesce(results, '[]');
  end if;

  if operation = 'publish' then
    if jsonb_typeof(payload->'active') is distinct from 'boolean' then
      raise sqlstate 'PT400' using message = 'Select a publication status.';
    end if;
    update rideon_private.bikes b set active = (payload->>'active')::boolean
    where b.id = bike_id_arg and (not host_scope or b.host_id = current_id) returning * into bike;
    if not found then raise sqlstate 'PT404' using message = 'Bike not found.'; end if;
    return rideon_private.bike_json(bike, true);
  end if;

  if operation = 'saveBike' then
    data_arg := payload->'data';
    if jsonb_typeof(data_arg) is distinct from 'object'
       or jsonb_typeof(data_arg->'cities') is distinct from 'array'
       or jsonb_typeof(data_arg->'active') is distinct from 'boolean'
       or jsonb_typeof(data_arg->'features') is distinct from 'array'
       or coalesce(length(btrim(data_arg->>'description')), 0) not between 1 and 1800
       or length(coalesce(data_arg->>'pickupInstructions', '')) > 600
       or coalesce(data_arg->>'price', '') !~ '^[0-9]{1,7}$'
       or coalesce(data_arg->>'engine', '') !~ '^[0-9]{1,4}$'
       or coalesce(data_arg->>'mileage', '') !~ '^[0-9]{1,3}$'
       or coalesce(data_arg->>'seats', '') not in ('1', '2')
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
    pickup_note := btrim(coalesce(data_arg->>'pickupInstructions', ''));
    if cardinality(cities_arg) not between 1 and 20 or price_arg not between 1 and 1000000
       or (data_arg->>'engine')::int not between 1 and 5000
       or (data_arg->>'mileage')::int not between 1 and 500
       or jsonb_array_length(data_arg->'features') not between 1 and 20
       or exists (select 1 from jsonb_array_elements(data_arg->'features') f
                  where jsonb_typeof(f) <> 'string' or length(btrim(f #>> '{}')) not between 1 and 90) then
      raise sqlstate 'PT400' using message = 'Check the listing rates, specifications and features.';
    end if;
    data_arg := jsonb_build_object(
      'brand', btrim(data_arg->>'brand'), 'model', btrim(data_arg->>'model'), 'category', data_arg->>'category',
      'transmission', data_arg->>'transmission', 'description', btrim(data_arg->>'description'), 'features', data_arg->'features',
      'engine', (data_arg->>'engine')::int, 'mileage', (data_arg->>'mileage')::int, 'seats', (data_arg->>'seats')::int,
      'fuel', 'Petrol', 'imageUrl', coalesce(data_arg->>'imageUrl', '')
    );
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
      insert into rideon_private.bikes (id, data, price, cities, active, image_mime, image_bytes, host_id, pickup_instructions)
      values (bike_id_arg, data_arg, price_arg, cities_arg, public_flag, photo_mime, photo_bytes,
        case when host_scope then current_id end, pickup_note)
      returning * into bike;
    else
      update rideon_private.bikes b set data = data_arg, price = price_arg, cities = cities_arg, active = public_flag,
        pickup_instructions = pickup_note,
        image_mime = case when photo is null then b.image_mime else photo_mime end,
        image_bytes = case when photo is null then b.image_bytes else photo_bytes end
      where b.id = bike_id_arg and (not host_scope or b.host_id = current_id) returning * into bike;
      if not found then raise sqlstate 'PT404' using message = 'Bike not found.'; end if;
    end if;
    return rideon_private.bike_json(bike, true);
  end if;

  if operation = 'bookings' then
    if (scope_arg = 'admin' or payload->'admin' = 'true'::jsonb) and not administrative then
      raise sqlstate 'PT403' using message = 'Administrator access is required.';
    end if;
    select jsonb_agg(case when host_scope then rideon_private.host_booking_json(b)
                          else rideon_private.booking_json(b) end order by b.created_at desc) into results
    from rideon_private.bookings b
    where case when host_scope then b.host_id = current_id
      when administrative and (scope_arg = 'admin' or payload->'admin' = 'true'::jsonb) then true
      else b.user_id = current_id end;
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
    if bike.host_id = current_id then raise sqlstate 'PT409' using message = 'You cannot book your own bike.'; end if;
    if rideon_private.has_conflict(bike.id, pickup_arg, return_arg) then
      raise sqlstate 'PT409' using message = 'This bike is unavailable for those dates.';
    end if;
    insert into rideon_private.bookings (user_id, request_key, bike_id, bike_name, rider_name, rider_email, phone,
      city, pickup, return_date, daily_rate, host_id, host_name, pickup_instructions)
    values (current_id, request_arg, bike.id, (bike.data->>'brand') || ' ' || (bike.data->>'model'), rider_arg, current_email,
      phone_arg, city_arg, pickup_arg, return_arg, bike.price, bike.host_id,
      (select h.name from rideon_private.hosts h where h.user_id = bike.host_id), bike.pickup_instructions)
    returning * into booking;
    return rideon_private.booking_json(booking);
  end if;

  if operation = 'status' then
    next_status := payload->>'status';
    if coalesce(next_status, '') not in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') then
      raise sqlstate 'PT400' using message = 'Select a valid booking status.';
    end if;
    if scope_arg = 'admin' and not administrative then
      raise sqlstate 'PT403' using message = 'Administrator access is required.';
    end if;
    can_manage := host_scope or (administrative and scope_arg <> 'rider');
    select * into booking from rideon_private.bookings b
    where b.id = bike_id_arg and
      case when host_scope then b.host_id = current_id when can_manage then true else b.user_id = current_id end
    for update;
    if not found then raise sqlstate 'PT404' using message = 'Booking not found.'; end if;
    if not can_manage and (next_status <> 'cancelled' or booking.pickup < rideon_private.local_date()) then
      raise sqlstate 'PT403' using message = 'Contact the host or marketplace staff to change this booking.';
    end if;
    if booking.status = next_status then
      return case when host_scope then rideon_private.host_booking_json(booking) else rideon_private.booking_json(booking) end;
    end if;
    if not ((booking.status = 'pending' and next_status in ('confirmed', 'cancelled'))
         or (booking.status = 'confirmed' and next_status in ('in_progress', 'cancelled'))
         or (booking.status = 'in_progress' and next_status = 'completed')) then
      raise sqlstate 'PT409' using message = 'This status change is unavailable.';
    end if;
    if next_status = 'in_progress' and booking.pickup > rideon_private.local_date() then
      raise sqlstate 'PT409' using message = 'Pickup cannot be recorded before the scheduled day.';
    end if;
    update rideon_private.bookings b set status = next_status where b.id = booking.id returning * into booking;
    return case when host_scope then rideon_private.host_booking_json(booking) else rideon_private.booking_json(booking) end;
  end if;

  raise sqlstate 'PT404' using message = 'Database operation not found.';
end;
$$;

revoke all on function rideon_private.host_json(rideon_private.hosts) from public, anon, authenticated;
revoke all on function rideon_private.block_json(rideon_private.bike_blocks) from public, anon, authenticated;
revoke all on function rideon_private.host_booking_json(rideon_private.bookings) from public, anon, authenticated;
