-- =====================================================================
--  Add privacy-consent record to profiles
-- =====================================================================
--  Records that a user accepted the Privacy Notice at signup, and which
--  version they accepted. The signup form passes these as auth metadata
--  (privacy_consented_at, privacy_version); the trigger below copies them
--  into public.profiles when the auth user is created.
--
--  Run this once in the Supabase SQL editor. It is idempotent.
-- ---------------------------------------------------------------------

-- 1. Columns ----------------------------------------------------------
alter table public.profiles
  add column if not exists privacy_consented_at timestamptz,
  add column if not exists privacy_version      text;

-- 2. Profile-creation trigger -----------------------------------------
--  This replaces the handle_new_user function so it also stores consent.
--  Safe to run even if the trigger already exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, privacy_consented_at, privacy_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    (new.raw_user_meta_data->>'privacy_consented_at')::timestamptz,
    new.raw_user_meta_data->>'privacy_version'
  )
  on conflict (id) do update
    set privacy_consented_at = coalesce(public.profiles.privacy_consented_at, excluded.privacy_consented_at),
        privacy_version      = coalesce(public.profiles.privacy_version, excluded.privacy_version);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
