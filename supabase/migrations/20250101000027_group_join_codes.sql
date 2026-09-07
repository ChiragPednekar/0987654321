-- ============================================================================
-- CaseCode — Group Join Codes
-- ============================================================================
alter table public.groups
  add column if not exists join_code text;

create index if not exists groups_join_code_idx
  on public.groups (join_code);
