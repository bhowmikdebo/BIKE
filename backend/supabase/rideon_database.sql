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
