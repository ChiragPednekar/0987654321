-- ============================================================================
-- CaseCode — the written formats beyond the full case
-- ============================================================================
-- A full case is one of the things an MBA student is asked to write, not the
-- only one. A guesstimate, a stock pitch, a brand teardown, a root-cause
-- analysis, a written ability test and a one-page memo are all different
-- exercises with different rubrics, and a student practising for placement
-- meets most of them.
--
-- All of them are additions to `case_format` rather than new machinery,
-- because the existing engine already does the whole job: a scenario, a
-- rubric, a free-text answer and a model that marks against that rubric. What
-- changes between a case and a guesstimate is the rubric — structure,
-- assumptions, arithmetic and sanity-check rather than analysis and
-- recommendation — and a rubric is data. Nothing in src/lib/ai needed to know
-- these exist.
--
-- 'behavioural' covers the HR and "tell me about yourself" family, which is
-- written practice here and feeds the interviewer later.
--
-- Separate migration from anything that reads these values: ALTER TYPE ... ADD
-- VALUE cannot be used in the same transaction that adds it.
-- ============================================================================

alter type public.case_format add value if not exists 'guesstimate';
alter type public.case_format add value if not exists 'stock_pitch';
alter type public.case_format add value if not exists 'brand_teardown';
alter type public.case_format add value if not exists 'rca';
alter type public.case_format add value if not exists 'wat';
alter type public.case_format add value if not exists 'memo';
alter type public.case_format add value if not exists 'behavioural';
