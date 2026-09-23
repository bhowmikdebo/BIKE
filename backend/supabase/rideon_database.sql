create schema rideon_private;
create extension if not exists btree_gist with schema extensions;

create table rideon_private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  role text not null default 'customer' check (role in ('customer', 'admin'))
);
