create table rideon_private.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  booking_id text not null references rideon_private.bookings(id) on delete cascade,
  scope text not null check (scope in ('rider', 'host', 'admin')),
  kind text not null check (kind in ('requested', 'confirmed', 'cancelled', 'completed', 'pickup_reminder', 'return_reminder')),
  visible_at timestamptz not null default now(),
  read_at timestamptz,
  unique (booking_id, recipient_id, scope, kind)
);
create index rideon_notifications_inbox_idx on rideon_private.booking_notifications (recipient_id, visible_at desc, id desc);
create index rideon_notifications_unread_idx on rideon_private.booking_notifications (recipient_id, visible_at)
  where read_at is null;

create table rideon_private.bike_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique references rideon_private.bookings(id) on delete cascade,
  bike_id text not null references rideon_private.bikes(id),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 600),
  created_at timestamptz not null default now()
);
create index rideon_reviews_bike_idx on rideon_private.bike_reviews (bike_id, created_at desc, id desc);
create index rideon_reviews_recent_idx on rideon_private.bike_reviews (created_at desc, id desc);

alter table rideon_private.booking_notifications enable row level security;
alter table rideon_private.bike_reviews enable row level security;
revoke all on rideon_private.booking_notifications, rideon_private.bike_reviews from public, anon, authenticated;

create function rideon_private.schedule_ride_reminders(b rideon_private.bookings)
returns void language sql set search_path = '' as $$
  insert into rideon_private.booking_notifications (recipient_id, booking_id, scope, kind, visible_at)
  select b.user_id, b.id, 'rider', reminder.kind, reminder.visible_at
  from (values
    ('pickup_reminder', ((b.pickup - 1) + time '09:00') at time zone 'Asia/Kolkata', b.status = 'confirmed'),
    ('return_reminder', ((b.return_date - 1) + time '09:00') at time zone 'Asia/Kolkata', b.status in ('confirmed', 'in_progress'))
  ) as reminder(kind, visible_at, applicable)
  where reminder.applicable and reminder.visible_at > now()
  on conflict (booking_id, recipient_id, scope, kind) do nothing;
$$;

create function rideon_private.notify_booking_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then return new; end if;
    if new.host_id is not null then
      insert into rideon_private.booking_notifications (recipient_id, booking_id, scope, kind)
      values (new.host_id, new.id, 'host', 'requested');
    else
      insert into rideon_private.booking_notifications (recipient_id, booking_id, scope, kind)
      select p.user_id, new.id, 'admin', 'requested' from rideon_private.profiles p where p.role = 'admin';
    end if;
    return new;
  end if;

  if old.status = new.status then return new; end if;

  if new.status in ('confirmed', 'cancelled', 'completed') and new.user_id is distinct from auth.uid() then
    insert into rideon_private.booking_notifications (recipient_id, booking_id, scope, kind)
    values (new.user_id, new.id, 'rider', new.status);
  end if;

  if new.status = 'cancelled' then
    if new.host_id is not null then
      if new.host_id is distinct from auth.uid() then
        insert into rideon_private.booking_notifications (recipient_id, booking_id, scope, kind)
        values (new.host_id, new.id, 'host', 'cancelled');
      end if;
    else
      insert into rideon_private.booking_notifications (recipient_id, booking_id, scope, kind)
      select p.user_id, new.id, 'admin', 'cancelled' from rideon_private.profiles p
      where p.role = 'admin' and p.user_id is distinct from auth.uid();
    end if;
  end if;

  if new.status = 'confirmed' then
    perform rideon_private.schedule_ride_reminders(new);
  elsif new.status in ('in_progress', 'completed', 'cancelled') then
    delete from rideon_private.booking_notifications n
    where n.booking_id = new.id and n.visible_at > now()
      and (n.kind = 'pickup_reminder' or (new.status <> 'in_progress' and n.kind = 'return_reminder'));
  end if;
  return new;
end;
$$;

create trigger rideon_booking_notifications after insert or update of status on rideon_private.bookings
for each row execute function rideon_private.notify_booking_change();

-- Schedule future reminders for active bookings created before this migration.
do $$
declare
  booking rideon_private.bookings;
begin
  for booking in select * from rideon_private.bookings where status in ('confirmed', 'in_progress') and return_date > rideon_private.local_date() loop
    perform rideon_private.schedule_ride_reminders(booking);
  end loop;
end;
$$;

create function rideon_private.review_json(r rideon_private.bike_reviews)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'bikeId', r.bike_id, 'bikeName', b.bike_name,
      'author', coalesce(nullif(split_part(regexp_replace(btrim(b.rider_name), '[[:space:]]+', ' ', 'g'), ' ', 1), ''), 'Rider'),
      'rating', r.rating, 'body', r.body, 'createdAt', r.created_at)
  from rideon_private.bookings b where b.id = r.booking_id;
$$;

create or replace function rideon_private.bike_json(b rideon_private.bikes, administrative boolean)
returns jsonb language sql stable set search_path = '' as $$
  select b.data || jsonb_build_object('id', b.id, 'price', b.price, 'cities', b.cities,
      'host', (select jsonb_build_object('name', h.name, 'slug', h.slug)
               from rideon_private.hosts h where h.user_id = b.host_id)) ||
    case when administrative then jsonb_build_object('active', b.active, 'hasUploadedImage', b.image_bytes is not null, 'pickupInstructions', b.pickup_instructions)
         else jsonb_build_object('rating', (select jsonb_build_object('average', round(avg(r.rating), 1), 'count', count(*))
                 from rideon_private.bike_reviews r where r.bike_id = b.id)) ||
              case when b.image_bytes is not null then jsonb_build_object('imageUrl', '/api/bikes/' || b.id || '/image') else '{}'::jsonb end
    end;
$$;

create or replace function rideon_private.booking_json(b rideon_private.bookings)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'bikeId', b.bike_id, 'bikeName', b.bike_name, 'riderName', b.rider_name,
    'riderEmail', b.rider_email, 'phone', b.phone, 'city', b.city, 'pickup', b.pickup,
    'returnDate', b.return_date, 'days', b.days, 'dailyRate', b.daily_rate, 'total', b.total,
    'status', b.status, 'createdAt', b.created_at,
    'reviewed', b.status = 'completed' and exists (select 1 from rideon_private.bike_reviews r where r.booking_id = b.id),
    'host', (select jsonb_build_object('name', b.host_name, 'slug', h.slug)
             from rideon_private.hosts h where h.user_id = b.host_id)
  ) || case when b.status in ('confirmed', 'in_progress') then
    jsonb_build_object('pickupInstructions', b.pickup_instructions) else '{}'::jsonb end;
$$;

create function rideon_private.engagement(operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_id uuid := auth.uid();
  booking rideon_private.bookings;
  review rideon_private.bike_reviews;
  item_id text := payload->>'id';
  rating_arg text := payload->>'rating';
  body_arg text := regexp_replace(coalesce(payload->>'body', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  page_arg text := coalesce(payload->>'page', '1');
  results jsonb;
begin
  if operation = 'recentReviews' then
    select coalesce(jsonb_agg(rideon_private.review_json(r) order by r.created_at desc, r.id desc), '[]') into results
    from (select br.* from rideon_private.bike_reviews br
      join rideon_private.bikes bike on bike.id = br.bike_id and bike.active
      order by br.created_at desc, br.id desc limit 3) r;
    return results;
  end if;

  if operation = 'bikeReviews' then
    if not exists (select 1 from rideon_private.bikes where id = item_id and active) then
      raise sqlstate 'PT404' using message = 'Bike not found.';
    end if;
    if page_arg !~ '^[1-9][0-9]{0,5}$' then raise sqlstate 'PT400' using message = 'Invalid review page.'; end if;
    select coalesce(jsonb_agg(rideon_private.review_json(r) order by r.created_at desc, r.id desc), '[]') into results
    from (select * from rideon_private.bike_reviews where bike_id = item_id
      order by created_at desc, id desc limit 11 offset (page_arg::integer - 1) * 10) r;
    return jsonb_build_object('items', results - 10, 'hasMore', jsonb_array_length(results) > 10);
  end if;

  if current_id is null then raise sqlstate 'PT401' using message = 'Sign in to continue.'; end if;

  if operation = 'notifications' then
    select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'bookingId', n.booking_id, 'bikeName', b.bike_name,
      'scope', n.scope, 'kind', n.kind, 'createdAt', n.visible_at, 'read', n.read_at is not null)
      order by n.visible_at desc, n.id desc), '[]') into results
    from (select * from rideon_private.booking_notifications
      where recipient_id = current_id and visible_at <= now() order by visible_at desc, id desc limit 30) n
    join rideon_private.bookings b on b.id = n.booking_id;
    return jsonb_build_object('items', results, 'unread', (select count(*) from rideon_private.booking_notifications n
      where n.recipient_id = current_id and n.visible_at <= now() and n.read_at is null));
  end if;

  if operation = 'readNotifications' then
    if item_id is null then
      update rideon_private.booking_notifications n set read_at = now()
      where n.recipient_id = current_id and n.visible_at <= now() and n.read_at is null;
    else
      if item_id !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
        raise sqlstate 'PT404' using message = 'Notification not found.';
      end if;
      update rideon_private.booking_notifications n set read_at = coalesce(n.read_at, now())
      where n.recipient_id = current_id and n.visible_at <= now() and n.id = item_id::uuid;
      if not found then raise sqlstate 'PT404' using message = 'Notification not found.'; end if;
    end if;
    return 'null'::jsonb;
  end if;

  if operation = 'reviewBooking' then
    if jsonb_typeof(payload->'rating') is distinct from 'number' or coalesce(rating_arg, '') !~ '^[1-5]$'
       or jsonb_typeof(payload->'body') is distinct from 'string' or char_length(body_arg) not between 10 and 600 then
      raise sqlstate 'PT400' using message = 'Choose 1 to 5 stars and write a review of 10 to 600 characters.';
    end if;
    select * into booking from rideon_private.bookings where id = item_id and user_id = current_id;
    if not found then raise sqlstate 'PT404' using message = 'Booking not found.'; end if;
    if booking.status <> 'completed' then raise sqlstate 'PT409' using message = 'Review your bike after the rental is complete.'; end if;

    insert into rideon_private.bike_reviews (booking_id, bike_id, rating, body)
    values (booking.id, booking.bike_id, rating_arg::smallint, body_arg)
    on conflict (booking_id) do nothing returning * into review;
    if not found then
      select * into strict review from rideon_private.bike_reviews where booking_id = booking.id;
      if review.rating <> rating_arg::smallint or review.body <> body_arg then
        raise sqlstate 'PT409' using message = 'You already reviewed this rental.';
      end if;
    end if;
    return rideon_private.review_json(review);
  end if;

  raise sqlstate 'PT404' using message = 'Database operation not found.';
end;
$$;

create or replace function public.rideon_api(operation text, payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select case when operation in ('recentReviews', 'bikeReviews', 'notifications', 'readNotifications', 'reviewBooking')
      then rideon_private.engagement(operation, payload)
      else rideon_private.dispatch(operation, payload) end;
$$;

revoke all on function rideon_private.schedule_ride_reminders(rideon_private.bookings),
  rideon_private.notify_booking_change(), rideon_private.review_json(rideon_private.bike_reviews),
  rideon_private.engagement(text, jsonb) from public, anon, authenticated;
grant execute on function rideon_private.engagement(text, jsonb) to anon, authenticated;
