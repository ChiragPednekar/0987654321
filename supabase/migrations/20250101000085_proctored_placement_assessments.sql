-- ============================================================================
-- College common assessments are sat under exam conditions
-- ============================================================================
-- The question is released only when a student starts, and the server stamps
-- that moment here: the elapsed time it gives is the one figure a student
-- cannot edit, and a submission with no sitting was never opened properly.
-- One row per student per assessment; a restart keeps the first stamp.
-- ============================================================================

create table public.placement_sittings (
  assessment_id uuid not null references public.placement_assessments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (assessment_id, user_id)
);

-- What the proctor saw, kept with the attempt for the faculty reviewer. Not a
-- penalty: the reviewer decides, and none of it goes into a company report.
alter table public.placement_attempts
  add column integrity jsonb,
  add column elapsed_seconds integer check (elapsed_seconds >= 0);

alter table public.placement_sittings enable row level security;
revoke all on public.placement_sittings from anon, authenticated;
grant all on public.placement_sittings to service_role;
