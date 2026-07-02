-- =====================================================================
--  Thrive Hub — Lock down the PT role + session_logs RLS
-- =====================================================================
--  WHY
--  Before this, anyone on the internet could create a "PT" account
--  (the role came from client-supplied signup metadata), link
--  themselves to any patient (pt_clients insert only checked
--  pt_id = auth.uid()), and then READ that patient's exercise
--  feedback (pain levels, notes) and message them. This file closes
--  that whole chain at the database level:
--
--    1. New signups are ALWAYS created as patients ('client'),
--       regardless of what the signup request claims.
--    2. Users can no longer change their own role (column-level
--       privileges: only full_name / avatar_url are updatable).
--    3. Acting as a PT (creating pt_clients links and programs)
--       now also requires profiles.role = 'pt'.
--    4. Patients can only message their own linked PT (and vice
--       versa) — no messaging arbitrary users by UUID.
--    5. session_logs gets RLS (it was missing from rls-policies.sql).
--
--  Existing PT accounts keep their role. To make someone a PT later,
--  run:  update public.profiles set role = 'pt' where id = '<uuid>';
--
--  HOW TO RUN: Supabase -> SQL Editor -> paste -> Run.
--  Safe to run more than once.
--
--  AFTER RUNNING, verify there are no unexpected PT accounts:
--    select id, full_name, role from public.profiles where role = 'pt';
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Force new signups to the patient role.
--    (Replaces the version from add-consent-to-profiles.sql; consent
--    handling is unchanged — only the role line differs.)
-- ---------------------------------------------------------------------
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
    'client',  -- ignore metadata: PT accounts are only created manually
    (new.raw_user_meta_data->>'privacy_consented_at')::timestamptz,
    new.raw_user_meta_data->>'privacy_version'
  )
  on conflict (id) do update
    set privacy_consented_at = coalesce(public.profiles.privacy_consented_at, excluded.privacy_consented_at),
        privacy_version      = coalesce(public.profiles.privacy_version, excluded.privacy_version);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Stop users from editing their own role (or consent audit trail).
--    RLS says WHICH rows you can update; column grants say WHICH
--    COLUMNS. The app only ever needs name + avatar edits.
-- ---------------------------------------------------------------------
revoke update on table public.profiles from authenticated, anon;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 3. PT-only actions now actually check the role.
-- ---------------------------------------------------------------------
create or replace function public.is_pt()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'pt'
  );
$$;

drop policy if exists "pt_clients_pt_all" on public.pt_clients;
create policy "pt_clients_pt_all"
  on public.pt_clients for all
  to authenticated
  using (pt_id = auth.uid() and public.is_pt())
  with check (pt_id = auth.uid() and public.is_pt());

drop policy if exists "programs_pt_all" on public.programs;
create policy "programs_pt_all"
  on public.programs for all
  to authenticated
  using (pt_id = auth.uid() and public.is_pt())
  with check (pt_id = auth.uid() and public.is_pt());

-- ---------------------------------------------------------------------
-- 4. Messages: only within an existing PT<->patient link.
--    (Before: any authenticated user could message any UUID.)
-- ---------------------------------------------------------------------
drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.pt_clients pc
      where (pc.pt_id = auth.uid() and pc.client_id = receiver_id)
         or (pc.client_id = auth.uid() and pc.pt_id = receiver_id)
    )
  );

-- ---------------------------------------------------------------------
-- 5. session_logs — enable RLS (was missing from rls-policies.sql).
--    Same model as exercise_feedback: patient owns their logs,
--    their linked PT can read them.
-- ---------------------------------------------------------------------
alter table public.session_logs enable row level security;

drop policy if exists "session_logs_client_all" on public.session_logs;
create policy "session_logs_client_all"
  on public.session_logs for all
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "session_logs_pt_read" on public.session_logs;
create policy "session_logs_pt_read"
  on public.session_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.pt_clients pc
      where pc.client_id = session_logs.client_id
        and pc.pt_id = auth.uid()
    )
  );
