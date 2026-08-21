-- ============================================================================
-- CaseCode — keep case statistics honest when rows are deleted
-- ============================================================================
-- `cases.total_submissions`, `cases.total_solved` and `cases.avg_score` are
-- denormalised counters. They were maintained only on the way up:
--
--   after_submission_insert()  total_submissions = total_submissions + 1
--   after_score_insert()       total_solved      = total_solved + 1
--                              avg_score         = avg(scores.percentage)
--
-- Nothing ever ran on the way down. Deleting a user cascades their submissions
-- and scores away (both tables carry `user_id ... on delete cascade`) but left
-- their contribution baked into the case row for ever. Reproduced against
-- production on 2026-08-21: a test account submitted to two cases, was deleted,
-- and both cases kept `total_submissions = 1` — one of them advertising an
-- `avg_score` of 0.00 that no surviving score row supported.
--
-- `completion_rate` is generated from total_solved / total_submissions, so the
-- drift propagated into the sort order and the stats on every case card.
--
-- The privacy policy (src/app/(legal)/privacy/page.tsx) does say anonymised
-- aggregate counts may survive account deletion. A count is one thing; a wrong
-- average is not an anonymised aggregate, it is a false statistic. Both are
-- corrected here.
--
-- Approach: recompute from live rows rather than decrement. `avg_score` was
-- already a full recompute, and full recomputation is self-healing — it repairs
-- drift from any cause, including drift that predates this migration, and it is
-- order-independent when several cascades fire in one transaction.
-- ============================================================================

create or replace function public.recompute_case_stats(p_case_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.cases c
     set total_submissions = stat.subs,
         total_solved      = stat.solved,
         avg_score         = stat.avg_pct
  from (
    select c2.id,
           (select count(*)
              from public.submissions s
             where s.case_id = c2.id)                     as subs,
           -- Mirrors after_score_insert(): a case counts as solved once per
           -- user, the first time any of that user's scores reaches the
           -- rubric's pass mark (60 when the case has no rubric, e.g. drills).
           (select count(distinct s.user_id)
              from public.scores s
             where s.case_id = c2.id
               and s.percentage >= coalesce(
                     (select r.pass_score from public.rubrics r
                       where r.case_id = c2.id), 60))     as solved,
           (select round(coalesce(avg(s.percentage), 0), 2)
              from public.scores s
             where s.case_id = c2.id)                     as avg_pct
      from public.cases c2
     where c2.id = any(p_case_ids)
  ) stat
  where stat.id = c.id
    and (c.total_submissions, c.total_solved, c.avg_score)
        is distinct from (stat.subs, stat.solved, stat.avg_pct);
$$;

revoke execute on function public.recompute_case_stats(uuid[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------- triggers --

-- Statement-level with a transition table, so deleting an account with fifty
-- submissions recomputes each affected case once rather than fifty times.
create or replace function public.on_rows_deleted_recompute_cases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_case_stats(
    array(select distinct d.case_id from deleted d where d.case_id is not null)
  );
  return null;
end;
$$;

drop trigger if exists submissions_after_delete on public.submissions;
create trigger submissions_after_delete
  after delete on public.submissions
  referencing old table as deleted
  for each statement execute function public.on_rows_deleted_recompute_cases();

drop trigger if exists scores_after_delete on public.scores;
create trigger scores_after_delete
  after delete on public.scores
  referencing old table as deleted
  for each statement execute function public.on_rows_deleted_recompute_cases();

-- Deleting the case itself cascades these rows away too; the update inside
-- recompute_case_stats simply matches nothing for a row that is already gone.

-- ---------------------------------------------------------------- backfill --

-- Every case, once, so any drift already in the table is cleared rather than
-- frozen in place at the moment the triggers were added.
select public.recompute_case_stats(array(select id from public.cases));
