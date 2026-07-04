-- Run as the database owner. All fixture rows are rolled back.
begin;

do $$
declare
  provider_id uuid := gen_random_uuid();
  rider_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  actor uuid;
  bike_id text := 'engagement-' || left(rider_id::text, 8);
  target_booking text;
  cancelled_booking text;
  pickup_day date := rideon_private.local_date() + 5;
  inbox jsonb;
  notification_id text;
  review_payload jsonb;
  review jsonb;
  public_reviews jsonb;
begin
  foreach actor in array array[provider_id, rider_id, other_id] loop
    insert into auth.users (id, email, email_confirmed_at) values (actor, actor || '@example.test', now());
    insert into rideon_private.profiles (user_id, name) values (actor, 'Test account');
  end loop;
  insert into rideon_private.hosts (user_id, slug, name) values (provider_id, bike_id, 'Test host');
  insert into rideon_private.bikes (id, price, cities, host_id, data)
  values (bike_id, 750, array['Goa'], provider_id, '{"brand":"Test","model":"Cruiser"}');
  insert into rideon_private.bookings (user_id, bike_id, bike_name, rider_name, rider_email, phone, city,
      pickup, return_date, daily_rate, request_key, host_id, host_name)
  values (rider_id, bike_id, 'Test Cruiser', 'Rider PrivateSurname', 'qa@example.test', '9999999999', 'Goa',
      pickup_day, pickup_day + 2, 750, gen_random_uuid(), provider_id, 'Test host') returning id into target_booking;

  perform set_config('request.jwt.claim.sub', provider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_id, 'email', provider_id || '@example.test')::text, true);
  inbox := public.rideon_api('notifications');
  notification_id := inbox #>> '{items,0,id}';
  if inbox->>'unread' is distinct from '1' or inbox #>> '{items,0,kind}' is distinct from 'requested' or
      inbox #>> '{items,0,bookingId}' is distinct from target_booking or inbox #>> '{items,0,scope}' is distinct from 'host' then
    raise exception 'The host did not get the booking request notification';
  end if;
  if has_table_privilege('authenticated', 'rideon_private.booking_notifications', 'select') or
     has_table_privilege('anon', 'rideon_private.bike_reviews', 'insert') then
    raise exception 'Private tables are exposed';
  end if;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'email', other_id || '@example.test')::text, true);
  if public.rideon_api('notifications')->>'unread' is distinct from '0' then raise exception 'Another account saw the notification'; end if;
  begin
    perform public.rideon_api('readNotifications', jsonb_build_object('id', notification_id));
    raise exception 'Another account marked the notification read';
  exception when sqlstate 'PT404' then null;
  end;

  perform set_config('request.jwt.claim.sub', provider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_id, 'email', provider_id || '@example.test')::text, true);
  perform public.rideon_api('readNotifications', jsonb_build_object('id', notification_id));
  if public.rideon_api('notifications')->>'unread' is distinct from '0' then raise exception 'Read action did not clear the unread count'; end if;
  perform public.rideon_api('status', jsonb_build_object('id', target_booking, 'status', 'confirmed', 'scope', 'host'));
  perform public.rideon_api('status', jsonb_build_object('id', target_booking, 'status', 'confirmed', 'scope', 'host'));
  if (select count(*) from rideon_private.booking_notifications n where n.booking_id = target_booking and n.visible_at > now()) <> 2 then
    raise exception 'Pickup and return reminders were not scheduled exactly once';
  end if;

  perform set_config('request.jwt.claim.sub', rider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', rider_id, 'email', rider_id || '@example.test')::text, true);
  inbox := public.rideon_api('notifications');
  if inbox->>'unread' is distinct from '1' or inbox #>> '{items,0,kind}' is distinct from 'confirmed' then
    raise exception 'The rider did not receive confirmation or saw future reminders early';
  end if;
  perform public.rideon_api('readNotifications');
  if (select count(*) from rideon_private.booking_notifications n where n.booking_id = target_booking and n.visible_at > now() and n.read_at is null) <> 2 then
    raise exception 'Mark all read cleared future reminders early';
  end if;
  review_payload := jsonb_build_object('id', target_booking, 'rating', 5, 'body', 'Smooth bike and a straightforward pickup.');
  begin
    perform public.rideon_api('reviewBooking', review_payload);
    raise exception 'An incomplete rental could be reviewed';
  exception when sqlstate 'PT409' then null;
  end;

  update rideon_private.bookings b set pickup = rideon_private.local_date() where b.id = target_booking;
  perform set_config('request.jwt.claim.sub', provider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_id, 'email', provider_id || '@example.test')::text, true);
  perform public.rideon_api('status', jsonb_build_object('id', target_booking, 'status', 'in_progress', 'scope', 'host'));
  perform public.rideon_api('status', jsonb_build_object('id', target_booking, 'status', 'completed', 'scope', 'host'));
  if exists (select 1 from rideon_private.booking_notifications n where n.booking_id = target_booking and n.visible_at > now()) then
    raise exception 'The completed rental still has scheduled reminders';
  end if;
  begin
    perform public.rideon_api('reviewBooking', review_payload);
    raise exception 'A host could review the rider booking';
  exception when sqlstate 'PT404' then null;
  end;

  perform set_config('request.jwt.claim.sub', rider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', rider_id, 'email', rider_id || '@example.test')::text, true);
  review := public.rideon_api('reviewBooking', review_payload);
  if review->>'rating' is distinct from '5' or review->>'author' is distinct from 'Rider' or
      review ?| array['bookingId', 'userId', 'riderEmail', 'phone'] then raise exception 'The review is incorrect or includes private information'; end if;
  if public.rideon_api('reviewBooking', review_payload) is distinct from review then raise exception 'Review retry changed the result'; end if;
  begin
    perform public.rideon_api('reviewBooking', review_payload || '{"rating":4}');
    raise exception 'A second review was accepted';
  exception when sqlstate 'PT409' then null;
  end;
  if public.rideon_api('bookings') #>> '{0,reviewed}' is distinct from 'true' then raise exception 'The booking is missing its review flag'; end if;

  insert into rideon_private.bookings (user_id, bike_id, bike_name, rider_name, rider_email, phone, city,
      pickup, return_date, daily_rate, request_key, host_id, host_name)
  values (rider_id, bike_id, 'Test Cruiser', 'Test Rider', 'qa@example.test', '9999999999', 'Goa',
      pickup_day + 3, pickup_day + 5, 750, gen_random_uuid(), provider_id, 'Test host') returning id into cancelled_booking;
  perform set_config('request.jwt.claim.sub', provider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_id, 'email', provider_id || '@example.test')::text, true);
  perform public.rideon_api('status', jsonb_build_object('id', cancelled_booking, 'status', 'confirmed', 'scope', 'host'));
  perform set_config('request.jwt.claim.sub', rider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', rider_id, 'email', rider_id || '@example.test')::text, true);
  perform public.rideon_api('status', jsonb_build_object('id', cancelled_booking, 'status', 'cancelled', 'scope', 'rider'));
  if exists (select 1 from rideon_private.booking_notifications n where n.booking_id = cancelled_booking and n.visible_at > now()) then
    raise exception 'The cancelled rental still has scheduled reminders';
  end if;
  perform set_config('request.jwt.claim.sub', provider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_id, 'email', provider_id || '@example.test')::text, true);
  if not exists (select 1 from jsonb_array_elements(public.rideon_api('notifications')->'items') as n(item)
    where n.item->>'bookingId' = cancelled_booking and n.item->>'kind' = 'cancelled') then
    raise exception 'The host did not receive the rider cancellation notice';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  public_reviews := public.rideon_api('bikeReviews', jsonb_build_object('id', bike_id));
  if jsonb_array_length(public_reviews->'items') <> 1 or public_reviews #>> '{items,0,id}' is distinct from review->>'id' then
    raise exception 'The verified review is missing from the public bike page';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.rideon_api('catalog')) as b(item)
    where b.item->>'id' = bike_id and b.item #>> '{rating,count}' = '1' and (b.item #>> '{rating,average}')::numeric = 5) then
    raise exception 'The public catalog is missing the rating summary';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.rideon_api('recentReviews')) as r(item) where r.item->>'id' = review->>'id') then
    raise exception 'The verified review is missing from the home feed';
  end if;
end;
$$;

rollback;
