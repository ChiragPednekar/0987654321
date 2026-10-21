-- The company pages link to /cases?firm=Investment%20Banking-style and
-- /cases?firm=Big%20Tech%20PM-style, but firm_style was null on every case:
-- migration 009 tagged it from company_track before any cases were seeded, and
-- the seed never set it. So the links opened an empty library.
--
-- company_track on generated cases is assigned at random, so it is no basis for
-- a style. The domain and format are: finance cases are valuation, deal and
-- markets problems; product cases are product sense, metrics and
-- prioritisation. MBB-style is left to the dedicated set (scripts/seed-mbb.ts),
-- written in the interview format those firms use — the older consulting cases
-- are written memos, not MBB-format interviews.

update public.cases
set firm_style = 'Investment Banking-style'
where firm_style is null
  and domain = 'finance'
  and format in ('full_case', 'model', 'stock_pitch', 'research_note');

update public.cases
set firm_style = 'Big Tech PM-style'
where firm_style is null
  and domain = 'product_management'
  and format in ('full_case', 'product_sense', 'metrics', 'prioritisation', 'rca');
