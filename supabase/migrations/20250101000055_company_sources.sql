-- ============================================================================
-- CaseCode — company profiles say where they came from
-- ============================================================================
-- The profiles seeded by 20250101000049 were written from general, widely
-- reported descriptions of each firm's campus process. Nobody checked them
-- against the firm's own careers page or a placement cell's records, but every
-- page said "last reviewed" with a date — which read as a verification that
-- never happened. The date was only when the text was written.
--
-- `sources` records what a profile has actually been checked against:
-- [{label, url, checked_on}]. An empty list means unverified, and the page now
-- says exactly that. A profile only claims to be checked once a source is
-- listed, and the claim carries the date of the most recent check.
--
-- `reviewed_on` keeps its name so the deployed code reading it does not break,
-- but it now means what it always did in practice: when the profile was
-- written.
--
-- Element shape (https URL, real date, not in the future) is validated by the
-- seeder, the only writer; the constraint here guarantees the column is an
-- array, which the pages rely on.
-- ============================================================================

alter table public.companies
  add column if not exists sources jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.companies
    add constraint companies_sources_is_array check (jsonb_typeof(sources) = 'array');
exception when duplicate_object then null; end $$;

comment on column public.companies.sources is
  '[{label, url, checked_on}] the profile was checked against. Empty means unverified.';
comment on column public.companies.reviewed_on is
  'When the profile text was written. Not a verification date — see sources.';
