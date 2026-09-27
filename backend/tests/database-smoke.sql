-- Run as the database owner. Successful checks roll back all fixture data.
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  rider_id uuid := gen_random_uuid();
  second_rider_id uuid := gen_random_uuid();
  pickup_on date := rideon_private.local_date();
  city text := 'RIDEON QA ' || substr(admin_id::text, 1, 8);
  bike jsonb;
  rental jsonb;
  reservation jsonb;
  requested jsonb;
  result jsonb;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values
    (admin_id, admin_id || '@example.test', now(), '{"name":"Temporary Operator"}'),
    (rider_id, rider_id || '@example.test', now(), '{"name":"Temporary Rider","role":"admin"}'),
    (second_rider_id, second_rider_id || '@example.test', now(), '{"name":"Another Temporary Rider"}');

  insert into rideon_private.profiles (user_id, name, role) values (admin_id, 'Temporary Operator', 'admin');
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'email', admin_id || '@example.test')::text, true);
  bike := public.rideon_api('saveBike', jsonb_build_object('data', jsonb_build_object(
    'brand', 'QA', 'model', 'Scooter', 'category', 'Scooters', 'transmission', 'Automatic',
    'description', 'Rollback-only smoke fixture', 'features', jsonb_build_array('storage'),
    'price', 575, 'cities', jsonb_build_array(city), 'active', true,
    'engine', 110, 'fuel', 'Petrol', 'seats', 2, 'mileage', 45
  )));

  perform set_config('request.jwt.claim.sub', rider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', rider_id, 'email', rider_id || '@example.test', 'user_metadata', '{"role":"admin"}'::jsonb)::text, true);
  result := public.rideon_api('account');
  if result->>'role' is distinct from 'customer' then raise exception 'User metadata granted an admin role'; end if;
  begin
    perform public.rideon_api('fleet');
    raise exception 'Rider was allowed to list admin inventory';
  exception when sqlstate 'PT403' then null; end;

  rental := jsonb_build_object('bikeId', bike->>'id', 'city', city, 'pickup', pickup_on, 'returnDate', pickup_on + 3);
  result := public.rideon_api('quote', rental);
  if result->>'total' is distinct from '1725' then raise exception 'Unexpected live quote: %', result; end if;
  requested := rental || jsonb_build_object(
    'riderName', 'Temporary Rider', 'phone', '9876543210', 'dailyRate', 575, 'agreement', true, 'requestKey', gen_random_uuid()
  );
  reservation := public.rideon_api('book', requested);
  if reservation->>'total' is distinct from '1725' or
     public.rideon_api('book', requested)->>'id' is distinct from reservation->>'id' then
    raise exception 'Booking total or idempotent retry failed';
  end if;
  if jsonb_array_length(public.rideon_api('catalog', rental)) <> 0 then
    raise exception 'A reserved bike remained available';
  end if;

  perform set_config('request.jwt.claim.sub', second_rider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', second_rider_id, 'email', second_rider_id || '@example.test')::text, true);
  if jsonb_array_length(public.rideon_api('bookings')) <> 0 then
    raise exception 'A rider could see another rider''s booking';
  end if;
  begin
    perform public.rideon_api('book', requested || jsonb_build_object('requestKey', gen_random_uuid()));
    raise exception 'Overlapping reservation was accepted';
  exception when exclusion_violation then null; end;
  begin
    perform public.rideon_api('status', jsonb_build_object('id', reservation->>'id', 'status', 'cancelled'));
    raise exception 'Rider could cancel a different rider''s booking';
  exception when sqlstate 'PT404' then null; end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'email', admin_id || '@example.test')::text, true);
  result := public.rideon_api('status', jsonb_build_object('id', reservation->>'id', 'status', 'confirmed'));
  if result->>'status' is distinct from 'confirmed' then raise exception 'Admin confirmation failed'; end if;
  perform public.rideon_api('status', jsonb_build_object('id', reservation->>'id', 'status', 'cancelled'));
  if jsonb_array_length(public.rideon_api('catalog', rental)) <> 1 then
    raise exception 'Cancelled booking did not release the bike';
  end if;
end;
$$;

rollback;
select 'Database workflow passed and fixtures rolled back' as result;
