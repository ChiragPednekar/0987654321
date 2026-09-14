-- ============================================================================
-- CaseCode — role-specific written formats
-- ============================================================================
-- The product manager's, the equity analyst's and the marketer's rounds, as
-- written formats on the existing case engine (see 20250101000038):
--
--   product_sense, metrics, prioritisation      — product management
--   research_note                               — equity research
--   gtm_plan, marketing_mix, campaign_critique  — marketing
--
-- Nothing else changes. The grader reads a scenario, a rubric and an answer;
-- the rubric seeded with each exercise (scripts/content/written-formats-roles.ts)
-- is what makes a metrics round marked on its north star and guardrails rather
-- than on "analysis".
--
-- Its own migration: ALTER TYPE ... ADD VALUE cannot share a transaction with
-- anything that uses the new values.
-- ============================================================================

alter type public.case_format add value if not exists 'product_sense';
alter type public.case_format add value if not exists 'metrics';
alter type public.case_format add value if not exists 'prioritisation';
alter type public.case_format add value if not exists 'research_note';
alter type public.case_format add value if not exists 'gtm_plan';
alter type public.case_format add value if not exists 'marketing_mix';
alter type public.case_format add value if not exists 'campaign_critique';
