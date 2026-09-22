-- ============================================================================
-- CaseCode — link students to what each firm publishes itself
-- ============================================================================
-- The company profiles are written guidance and say, correctly, that they are
-- unverified. The obvious way to "fix" that is to scrape a question bank off
-- Glassdoor or AmbitionBox and relabel it verified. That would be wrong three
-- times over: those terms forbid republishing into a paid product, crowd-posted
-- recollections cannot be verified by anyone, and calling them verified would
-- recreate precisely the false claim 20250101000055 was written to remove.
--
-- This does the opposite. Most of these firms publish candidate material
-- themselves — McKinsey documents Solve, Bain publishes named practice cases,
-- Kearney publishes a worked case example and an interview guidebook. That
-- material is first-party, free, meant to be read by candidates, and better
-- than anything a third party recollects. It was simply never linked.
--
-- `official_links` is [{label, url, note}] pointing at the FIRM'S OWN domain.
-- The seeder enforces that: a link must be https and its host must match the
-- company's declared official domain, so this column cannot quietly become a
-- list of prep-vendor affiliate links.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not mark anything verified. `sources` still means "a human read this
-- against the profile", and linking a page is not reading it. The two columns
-- answer different questions: official_links is "where to go and read what the
-- firm says", sources is "what this text was checked against".
-- ============================================================================

alter table public.companies
  add column if not exists official_links jsonb not null default '[]'::jsonb;

alter table public.companies
  add column if not exists official_domain text;

do $$ begin
  alter table public.companies
    add constraint companies_official_links_is_array
    check (jsonb_typeof(official_links) = 'array');
exception when duplicate_object then null; end $$;

comment on column public.companies.official_links is
  '[{label, url, note}] the firm publishes itself for candidates. Seeder enforces the host matches official_domain.';
comment on column public.companies.official_domain is
  'The firm''s own domain. Every official_links entry must be on it or a subdomain of it.';
