-- =====================================================================
--  Thrive Hub — Row Level Security (RLS) policies
-- =====================================================================
--  WHAT THIS DOES
--  Your web app talks to Supabase directly from the browser using the
--  PUBLIC ("anon"/publishable) key. That key is visible to anyone who
--  opens your site. The ONLY thing that stops one patient from reading
--  another patient's health programs, pain feedback, and private
--  messages is the policies below. Without them, every logged-in user
--  can read (and write) the entire database.
--
--  HOW TO RUN IT
--  1. Open your Supabase project -> SQL Editor -> "New query"
--  2. Paste this whole file in
--  3. Click "Run"
--  It is safe to run more than once (it drops + recreates each policy).
--
--  MODEL
--  - profiles        : you can read all profiles (needed so a PT can
--                      search/find patients and so chat shows names),
--                      but you can only edit your OWN profile.
--  - programs        : a PT owns programs they create (pt_id); a patient
--                      can read the programs assigned to them (client_id).
--  - exercises       : visible/editable through their parent program.
--  - pt_clients      : a PT manages their own client links; a patient can
--                      see which PT(s) they're linked to.
--  - exercise_library: private to the PT who owns it.
--  - exercise_feedback: a patient owns their own; their PT can read it.
--  - messages        : only the sender and receiver can see a message.
-- =====================================================================

-- ---------- enable RLS on every table ----------
alter table public.profiles          enable row level security;
alter table public.programs          enable row level security;
alter table public.exercises         enable row level security;
alter table public.pt_clients        enable row level security;
alter table public.exercise_library  enable row level security;
alter table public.exercise_feedback enable row level security;
alter table public.messages          enable row level security;

-- =====================================================================
--  profiles
-- =====================================================================
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);
-- NOTE: this lets any signed-in user read names/roles of other users,
-- which your "Add client -> search by name" flow depends on. It does NOT
-- expose health data (that's locked down below). If you later add an
-- invite-by-email flow you can tighten this.

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- =====================================================================
--  programs
-- =====================================================================
drop policy if exists "programs_pt_all" on public.programs;
create policy "programs_pt_all"
  on public.programs for all
  to authenticated
  using (pt_id = auth.uid())
  with check (pt_id = auth.uid());

drop policy if exists "programs_client_read" on public.programs;
create policy "programs_client_read"
  on public.programs for select
  to authenticated
  using (client_id = auth.uid());

-- =====================================================================
--  exercises  (access flows through the parent program)
-- =====================================================================
drop policy if exists "exercises_read" on public.exercises;
create policy "exercises_read"
  on public.exercises for select
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id
        and (p.pt_id = auth.uid() or p.client_id = auth.uid())
    )
  );

drop policy if exists "exercises_pt_write" on public.exercises;
create policy "exercises_pt_write"
  on public.exercises for all
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id and p.pt_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = exercises.program_id and p.pt_id = auth.uid()
    )
  );

-- =====================================================================
--  pt_clients  (PT <-> patient links)
-- =====================================================================
drop policy if exists "pt_clients_pt_all" on public.pt_clients;
create policy "pt_clients_pt_all"
  on public.pt_clients for all
  to authenticated
  using (pt_id = auth.uid())
  with check (pt_id = auth.uid());

drop policy if exists "pt_clients_client_read" on public.pt_clients;
create policy "pt_clients_client_read"
  on public.pt_clients for select
  to authenticated
  using (client_id = auth.uid());

-- =====================================================================
--  exercise_library  (private to the owning PT)
-- =====================================================================
drop policy if exists "exercise_library_pt_all" on public.exercise_library;
create policy "exercise_library_pt_all"
  on public.exercise_library for all
  to authenticated
  using (pt_id = auth.uid())
  with check (pt_id = auth.uid());

-- =====================================================================
--  exercise_feedback  (patient owns it; their PT can read it)
-- =====================================================================
drop policy if exists "exercise_feedback_client_all" on public.exercise_feedback;
create policy "exercise_feedback_client_all"
  on public.exercise_feedback for all
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "exercise_feedback_pt_read" on public.exercise_feedback;
create policy "exercise_feedback_pt_read"
  on public.exercise_feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.pt_clients pc
      where pc.client_id = exercise_feedback.client_id
        and pc.pt_id = auth.uid()
    )
  );

-- =====================================================================
--  messages  (only sender or receiver can see; only sender can send)
-- =====================================================================
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid());

-- =====================================================================
--  OPTIONAL — auto-create a profile row when someone signs up
-- =====================================================================
--  Your signup form passes full_name + role as auth metadata, but a row
--  in public.profiles has to be created from it. If new sign-ups already
--  get a profile row, you can SKIP this block. If new users show up with
--  no name / wrong role, run it. It is safe and idempotent.
-- ---------------------------------------------------------------------
-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer set search_path = public
-- as $$
-- begin
--   insert into public.profiles (id, full_name, role)
--   values (
--     new.id,
--     coalesce(new.raw_user_meta_data->>'full_name', ''),
--     coalesce(new.raw_user_meta_data->>'role', 'client')
--   )
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $$;
--
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
