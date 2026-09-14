-- ============================================================================
-- CaseCode — presentation round: deck critique
-- ============================================================================
-- A student uploads a deck as a PDF — a case competition submission, an
-- interview presentation — and gets it reviewed the way a partner reads one:
-- does the storyline answer the question, does every title state a takeaway,
-- does each slide carry one message, do the charts prove it.
--
-- THE FILE IS NEVER STORED
--
-- The PDF goes to the model in the request and is discarded. What is kept is
-- the review, the file name and a hash for returning a stored review of the
-- same deck. Decks carry client names, competition entries and unpublished
-- numbers; nothing here needs the file once it has been read.
--
-- A SUGGESTED TITLE NEVER STATES A NUMBER THE DECK DOES NOT
--
-- Each slide's suggested action title may use only figures the model reports
-- reading on that slide (src/lib/deck.ts). Anything else becomes [X], the same
-- guarantee as resume rewrites.
--
-- QUOTA AND ERASURE WORK AS FOR RESUME CRITIQUES
--
-- A review is a graded piece of work and counts against the grading allowance;
-- quota_status() below adds deck reviews. Deleting a review erases its content
-- but keeps the row, so deleting cannot refund the allowance
-- (see 20250101000047).
-- ============================================================================

create table if not exists public.deck_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  file_name   text,
  context     text,
  input_hash  text,
  result      jsonb,
  model       text,
  erased_at   timestamptz,
  created_at  timestamptz not null default now(),

  constraint deck_reviews_erased_is_empty check (
    erased_at is null
    or (file_name is null and context is null and input_hash is null and result is null)
  )
);

create index if not exists deck_reviews_user_idx on public.deck_reviews (user_id, created_at desc);
create index if not exists deck_reviews_hash_idx on public.deck_reviews (user_id, input_hash) where erased_at is null;

alter table public.deck_reviews enable row level security;
drop policy if exists "own deck reviews" on public.deck_reviews;
create policy "own deck reviews" on public.deck_reviews for select using (user_id = auth.uid());
revoke all on public.deck_reviews from anon, authenticated;
grant select on public.deck_reviews to authenticated;
grant select, insert, update, delete on public.deck_reviews to service_role;

/**
 * quota_status(), counting deck reviews as gradings as well.
 *
 * Supersedes 20250101000047. Identical except that gradings_used now adds
 * deck reviews in the window — erased ones included.
 */
create or replace function public.quota_status(
  p_user               uuid,
  p_window_days        integer,
  p_default_gradings   integer,
  p_default_interviews integer
)
returns table (
  is_pro          boolean,
  grading_limit   integer,
  interview_limit integer,
  gradings_used   bigint,
  interviews_used bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with deactivated as (
    select exists (
      select 1 from public.users u
      where u.id = p_user and u.deactivated_at is not null
    ) as off
  ),
  pro as (
    select public.has_pro(p_user) as ok
  ),
  override as (
    select max(i.grading_quota) as g, max(i.interview_quota) as v
    from public.institution_members m
    join public.institutions i on i.id = m.institution_id
    where m.user_id = p_user
      and not i.is_suspended
      and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
      and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
  )
  select
    pro.ok,
    case when deactivated.off then 0
         else coalesce(override.g, p_default_gradings) end,
    case when deactivated.off then 0
         else coalesce(override.v, p_default_interviews) end,
    (select count(*) from public.scores s
      where s.user_id = p_user
        and s.evaluated_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.resume_critiques r
      where r.user_id = p_user
        and r.created_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.deck_reviews d
      where d.user_id = p_user
        and d.created_at > now() - make_interval(days => p_window_days)),
    (select count(*) from public.chat_sessions c
      where c.user_id = p_user
        and c.created_at > now() - make_interval(days => p_window_days))
  from pro, override, deactivated;
$$;

-- Restated for the same reason as in 20250101000047: 20250101000029
-- established that this takes a user id and must be unreachable except by the
-- service role. Revoking from PUBLIC is the part that actually closes it.
revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, anon, authenticated;
