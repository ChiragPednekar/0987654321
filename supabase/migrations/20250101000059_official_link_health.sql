-- ============================================================================
-- CaseCode — notice a dead official link before a student does
-- ============================================================================
-- 20250101000058 put 48 links to firms' own careers pages on the company
-- profiles. Careers sites get restructured constantly, and one of these was
-- already rotten when it was checked a day later: HUL's UFLP URL now redirects
-- to a general India landing page with no process on it. A dead link under a
-- heading that says "straight from the firm" is worse than no link at all.
--
-- `link_health` records what the checker last saw per URL:
--   [{url, status, checked_at, failures}]
--
-- WHAT COUNTS AS BROKEN, AND WHY IT IS NARROW
--
-- Only 404, 410 and a connection that cannot be made. Deliberately NOT 403,
-- 429 or 5xx — because those are what a live, healthy site returns to an
-- automated fetcher it does not like. That is not a guess: kearney.com returns
-- 403 to every programmatic request and serves the page perfectly to a
-- browser. Treating 403 as broken would have hidden three good links.
--
-- A link also has to fail twice in a row before it is hidden. One timeout on
-- one night is a network, not a dead page.
--
-- The point of storing this rather than only logging it is that the company
-- page can then hide a link it knows is dead, so the fix happens without
-- anyone being on duty.
-- ============================================================================

alter table public.companies
  add column if not exists link_health jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.companies
    add constraint companies_link_health_is_array
    check (jsonb_typeof(link_health) = 'array');
exception when duplicate_object then null; end $$;

comment on column public.companies.link_health is
  '[{url, status, checked_at, failures}] from the link checker. failures >= 2 with a 404/410/unreachable status means the page hides it.';
