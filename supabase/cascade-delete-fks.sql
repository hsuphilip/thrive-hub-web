-- =====================================================================
--  Thrive Hub — convert user-related FKs to ON DELETE CASCADE
-- =====================================================================
--  WHY
--  Deleting a user in Supabase Auth cascades through profiles
--  (profiles.id -> auth.users(id) is already CASCADE), but several
--  tables referenced profiles(id) / programs(id) / session_logs(id)
--  with NO ACTION, which blocked the delete. This switches them to
--  CASCADE so removing an auth user auto-cleans all of their rows:
--    user -> profile -> programs / messages / session_logs / feedback
--
--  HOW TO RUN
--  Supabase -> SQL Editor -> New query -> paste -> Run. Safe to run once.
-- =====================================================================

-- programs -> profiles
alter table public.programs drop constraint if exists programs_pt_id_fkey;
alter table public.programs add constraint programs_pt_id_fkey
  foreign key (pt_id) references public.profiles(id) on delete cascade;

alter table public.programs drop constraint if exists programs_client_id_fkey;
alter table public.programs add constraint programs_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete cascade;

-- session_logs -> profiles / programs
alter table public.session_logs drop constraint if exists session_logs_client_id_fkey;
alter table public.session_logs add constraint session_logs_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete cascade;

alter table public.session_logs drop constraint if exists session_logs_program_id_fkey;
alter table public.session_logs add constraint session_logs_program_id_fkey
  foreign key (program_id) references public.programs(id) on delete cascade;

-- exercise_feedback -> profiles / session_logs
alter table public.exercise_feedback drop constraint if exists exercise_feedback_client_id_fkey;
alter table public.exercise_feedback add constraint exercise_feedback_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete cascade;

alter table public.exercise_feedback drop constraint if exists exercise_feedback_session_log_id_fkey;
alter table public.exercise_feedback add constraint exercise_feedback_session_log_id_fkey
  foreign key (session_log_id) references public.session_logs(id) on delete cascade;

-- messages -> profiles
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.messages drop constraint if exists messages_receiver_id_fkey;
alter table public.messages add constraint messages_receiver_id_fkey
  foreign key (receiver_id) references public.profiles(id) on delete cascade;
