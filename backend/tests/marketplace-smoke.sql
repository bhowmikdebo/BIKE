-- Run as the database owner. All accounts, bikes, dates and bookings are test fixtures.
begin;

do $$
declare
  host_a uuid := gen_random_uuid();
  host_b uuid := gen_random_uuid();
  rider uuid := gen_random_uuid();
  actor uuid;
  first_date date := rideon_private.local_date();
  city text := 'Marketplace QA ' || left(host_a::text, 8);
  public_host jsonb;
  listing jsonb;
  bike jsonb;
  bike_b jsonb;
  rental jsonb;
  request jsonb;
  reservation jsonb;
  block_record jsonb;
  result jsonb;
begin
  foreach actor in array array[host_a, host_b, rider] loop
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    values (actor, actor || '@example.test', now(), '{"name":"Marketplace fixture"}');
  end loop;
  listing := jsonb_build_object(
    'brand', 'QA', 'model', 'Marketplace scooter', 'category', 'Scooters', 'transmission', 'Automatic',
    'description', 'Temporary marketplace fixture', 'features', jsonb_build_array('Storage'),
    'price', 625, 'cities', jsonb_build_array(city), 'active', true,
    'engine', 110, 'fuel', 'Petrol', 'seats', 2, 'mileage', 45,
    'pickupInstructions', 'Meet at the private pickup point'
  );

  perform set_config('request.jwt.claim.sub', host_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', host_a, 'email', host_a || '@example.test')::text, true);
  begin
    perform public.rideon_api('fleet', '{"scope":"host"}');
    raise exception 'A new rider received host dashboard access without onboarding';
  exception when sqlstate 'PT403' then null; end;
  result := public.rideon_api('hostProfile', '{"name":"First Host","bio":"Local rentals","role":"admin"}');
  public_host := result->'host';
  if result->>'role' is distinct from 'customer' or public_host->>'name' is distinct from 'First Host' then
    raise exception 'Host onboarding unexpectedly changed staff permissions';
  end if;
  bike := public.rideon_api('saveBike', jsonb_build_object('scope','host','data',listing || jsonb_build_object('host_id', host_b)));
  if bike->'host'->>'slug' is distinct from public_host->>'slug' then raise exception 'Host could choose another listing owner'; end if;

  result := public.rideon_api('storefront', jsonb_build_object('slug', public_host->>'slug'));
  if jsonb_array_length(result->'bikes') <> 1 or result->'bikes'->0 ? 'pickupInstructions' or
     result->'host' ? 'email' or result->'host' ? 'user_id' then
    raise exception 'Storefront inventory or privacy check failed';
  end if;

  block_record := public.rideon_api('block', jsonb_build_object(
    'bikeId', bike->>'id', 'pickup', first_date + 5, 'returnDate', first_date + 8));
  begin
    perform public.rideon_api('quote', jsonb_build_object(
      'bikeId', bike->>'id', 'city', city, 'pickup', first_date + 6, 'returnDate', first_date + 7));
    raise exception 'The catalog accepted a quote during a host calendar block';
  exception when sqlstate 'PT409' then null; end;

  perform set_config('request.jwt.claim.sub', host_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', host_b, 'email', host_b || '@example.test')::text, true);
  perform public.rideon_api('hostProfile', '{"name":"Second Host"}');
  if jsonb_array_length(public.rideon_api('fleet', '{"scope":"host"}')) <> 0 then raise exception 'Fleet listed another host''s bike'; end if;
  begin
    perform public.rideon_api('publish', jsonb_build_object('id',bike->>'id','scope','host','active',false));
    raise exception 'A different host could unpublish a bike';
  exception when sqlstate 'PT404' then null; end;
  begin
    perform public.rideon_api('saveBike', jsonb_build_object('id',bike->>'id','scope','host','data',listing));
    raise exception 'A different host could update a bike';
  exception when sqlstate 'PT404' then null; end;
  begin
    perform public.rideon_api('unblock', jsonb_build_object('bikeId',bike->>'id','blockId',block_record->>'id'));
    raise exception 'A different host could delete an availability block';
  exception when sqlstate 'PT404' then null; end;
  bike_b := public.rideon_api('saveBike', jsonb_build_object('scope','host','data',listing));
  if bike_b->'host'->>'name' is distinct from 'Second Host' then raise exception 'Second host cannot create a bike'; end if;

  rental := jsonb_build_object('bikeId',bike->>'id','city',city,'pickup',first_date,'returnDate',first_date+3);
  request := rental || jsonb_build_object('riderName','Second Host','phone','9876543210','dailyRate',625,'agreement',true,'requestKey',gen_random_uuid());
  reservation := public.rideon_api('book', request);
  if reservation->>'total' is distinct from '1875' or reservation->'host'->>'name' is distinct from 'First Host' or reservation ? 'pickupInstructions' then
    raise exception 'A host could not book as a rider, or rider pickup information leaked before confirmation';
  end if;
  if jsonb_array_length(public.rideon_api('bookings')) <> 1 or
     jsonb_array_length(public.rideon_api('bookings', '{"scope":"host"}')) <> 0 then
    raise exception 'Outgoing and incoming reservation histories are mixed';
  end if;

  perform set_config('request.jwt.claim.sub', rider::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', rider, 'email', rider || '@example.test')::text, true);
  begin
    perform public.rideon_api('status', jsonb_build_object('scope','host','id',reservation->>'id','status','confirmed'));
    raise exception 'A rider obtained host dashboard permissions';
  exception when sqlstate 'PT403' then null; end;

  perform set_config('request.jwt.claim.sub', host_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', host_a, 'email', host_a || '@example.test')::text, true);
  result := public.rideon_api('bookings', '{"scope":"host"}');
  if jsonb_array_length(result) <> 1 or result->0 ? 'phone' or result->0 ? 'riderEmail' then
    raise exception 'Host inbox is incorrect or pending rider contact was shared';
  end if;
  begin
    perform public.rideon_api('block', rental);
    raise exception 'Host blocked dates over an existing booking';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.rideon_api('book', request || jsonb_build_object('requestKey',gen_random_uuid()));
    raise exception 'Host could request its own bike';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'You cannot book your own bike.' then raise; end if;
  end;

  result := public.rideon_api('status', jsonb_build_object('scope','host','id',reservation->>'id','status','confirmed'));
  if result->>'status' is distinct from 'confirmed' or result->>'phone' is distinct from '9876543210' then
    raise exception 'Host could not confirm the booking or access the confirmed rider''s phone';
  end if;
  perform public.rideon_api('unblock',jsonb_build_object('bikeId',bike->>'id','blockId',block_record->>'id'));
  if jsonb_array_length(public.rideon_api('blocks', jsonb_build_object('bikeId',bike->>'id'))) <> 0 then
    raise exception 'Host could not remove an availability block';
  end if;

  perform set_config('request.jwt.claim.sub', host_b::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', host_b, 'email', host_b || '@example.test')::text, true);
  result := public.rideon_api('bookings');
  if result->0->>'pickupInstructions' is distinct from 'Meet at the private pickup point' then
    raise exception 'Rider did not receive confirmed pickup instructions';
  end if;
  begin
    perform public.rideon_api('status',jsonb_build_object('scope','host','id',reservation->>'id','status','in_progress'));
    raise exception 'A different host could mark pickup';
  exception when sqlstate 'PT404' then null; end;
end;
$$;

rollback;
select 'Marketplace ownership, availability, onboarding, and rider privacy passed; fixtures rolled back' as result;
