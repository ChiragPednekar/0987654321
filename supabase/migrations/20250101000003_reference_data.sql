-- ============================================================================
-- CaseCode — reference data (categories, learning paths, badges)
-- ============================================================================
-- Idempotent: safe to re-run. Cases themselves are loaded by `npm run seed`,
-- which also wires learning_path_steps once case rows exist.
-- ============================================================================

-- ----------------------------------------------------- case categories ----

insert into public.case_categories (slug, name, domain, description, sort_order)
values
  -- finance
  ('financial-statements', 'Financial Statements', 'finance',
   'Reading, linking and interrogating the three statements.', 10),
  ('valuation',            'Valuation',            'finance',
   'Comparables, precedent transactions and intrinsic value.', 20),
  ('dcf',                  'DCF',                  'finance',
   'Free cash flow forecasting, WACC and terminal value.', 30),
  ('npv-irr',              'NPV & IRR',            'finance',
   'Capital budgeting and project selection under constraints.', 40),
  ('mergers-acquisitions', 'M&A',                  'finance',
   'Accretion/dilution, synergies and deal structuring.', 50),
  ('capital-raising',      'Capital Raising',      'finance',
   'Debt vs equity, dilution maths and runway planning.', 60),

  -- consulting
  ('profitability',        'Profitability',        'consulting',
   'Isolating whether a margin problem is revenue or cost.', 10),
  ('market-entry',         'Market Entry',         'consulting',
   'Sizing, mode of entry and go/no-go recommendations.', 20),
  ('growth-strategy',      'Growth Strategy',      'consulting',
   'Organic, inorganic and adjacency-led growth options.', 30),
  ('pricing',              'Pricing',              'consulting',
   'Willingness to pay, price architecture and elasticity.', 40),
  ('operations',           'Operations',           'consulting',
   'Capacity, throughput, supply chain and cost-to-serve.', 50),
  ('market-sizing',        'Market Sizing',        'consulting',
   'Top-down and bottom-up estimation under uncertainty.', 60),

  -- product management
  ('metrics',              'Metrics',              'product_management',
   'Choosing, instrumenting and diagnosing product metrics.', 10),
  ('prioritization',       'Prioritization',       'product_management',
   'Trading off reach, impact, confidence and effort.', 20),
  ('product-launch',       'Product Launch',       'product_management',
   'GTM, rollout sequencing and launch readiness.', 30),
  ('retention',            'Retention',            'product_management',
   'Cohort behaviour, habit loops and churn diagnosis.', 40),
  ('product-growth',       'Growth',               'product_management',
   'Acquisition loops, activation and monetisation.', 50),
  ('product-design',       'Product Sense',        'product_management',
   'User problems, trade-offs and solution design.', 60),

  -- marketing
  ('brand-strategy',       'Brand Strategy',       'marketing',
   'Positioning, architecture and equity.', 10),
  ('performance-marketing','Performance Marketing','marketing',
   'CAC, LTV, channel mix and attribution.', 20),
  ('gtm',                  'Go To Market',         'marketing',
   'Segmentation, targeting and launch campaigns.', 30),

  -- strategy
  ('corporate-strategy',   'Corporate Strategy',   'strategy',
   'Portfolio choices, vertical integration and capital allocation.', 10),
  ('competitive-strategy', 'Competitive Strategy', 'strategy',
   'Moats, rivalry and response to disruption.', 20),
  ('transformation',       'Transformation',       'strategy',
   'Turnarounds, restructuring and change programmes.', 30)
on conflict (slug) do update
  set name        = excluded.name,
      domain      = excluded.domain,
      description = excluded.description,
      sort_order  = excluded.sort_order;

-- ------------------------------------------------------- learning paths ----

insert into public.learning_paths (slug, title, domain, description, icon, sort_order)
values
  ('finance-track', 'Finance Track', 'finance',
   'From reading a balance sheet to running an M&A model. Twelve cases, each unlocking the next.',
   'trending-up', 10),
  ('consulting-track', 'Consulting Track', 'consulting',
   'The classic casebook progression: profitability, market entry, growth, pricing, operations.',
   'briefcase', 20),
  ('product-management-track', 'Product Management Track', 'product_management',
   'Metrics, prioritisation, launch, retention and growth — the PM interview loop end to end.',
   'layout-grid', 30)
on conflict (slug) do update
  set title       = excluded.title,
      description = excluded.description,
      icon        = excluded.icon,
      sort_order  = excluded.sort_order;

-- --------------------------------------------------------------- badges ----

insert into public.badges (slug, name, description, icon, tier, criteria, xp_reward, sort_order)
values
  ('first-case', 'First Blood', 'Solved your first case.', 'flag',
   'bronze', '{"type": "cases_solved", "threshold": 1}', 50, 10),
  ('ten-cases', 'Getting Serious', 'Solved 10 cases.', 'flame',
   'bronze', '{"type": "cases_solved", "threshold": 10}', 150, 20),
  ('fifty-cases', 'Case Machine', 'Solved 50 cases.', 'zap',
   'silver', '{"type": "cases_solved", "threshold": 50}', 500, 30),
  ('hundred-cases', 'Centurion', 'Solved 100 cases.', 'crown',
   'gold', '{"type": "cases_solved", "threshold": 100}', 1500, 40),

  ('finance-master', 'Finance Master', 'Solved 25 finance cases.', 'trending-up',
   'gold', '{"type": "domain_cases_solved", "domain": "finance", "threshold": 25}', 750, 50),
  ('consulting-expert', 'Consulting Expert', 'Solved 25 consulting cases.', 'briefcase',
   'gold', '{"type": "domain_cases_solved", "domain": "consulting", "threshold": 25}', 750, 60),
  ('product-leader', 'Product Leader', 'Solved 25 product management cases.', 'layout-grid',
   'gold', '{"type": "domain_cases_solved", "domain": "product_management", "threshold": 25}', 750, 70),
  ('marketing-pro', 'Marketing Pro', 'Solved 15 marketing cases.', 'megaphone',
   'silver', '{"type": "domain_cases_solved", "domain": "marketing", "threshold": 15}', 500, 80),
  ('strategist', 'Strategist', 'Solved 15 strategy cases.', 'compass',
   'silver', '{"type": "domain_cases_solved", "domain": "strategy", "threshold": 15}', 500, 90),

  ('hard-mode', 'Hard Mode', 'Solved 10 hard cases.', 'mountain',
   'gold', '{"type": "difficulty_cases_solved", "difficulty": "hard", "threshold": 10}', 800, 100),

  ('streak-7', 'Week Streak', 'Solved a case 7 days in a row.', 'calendar-check',
   'bronze', '{"type": "streak", "threshold": 7}', 200, 110),
  ('streak-30', 'Month Streak', 'Solved a case 30 days in a row.', 'calendar-heart',
   'gold', '{"type": "streak", "threshold": 30}', 1000, 120),

  ('near-perfect', 'Near Perfect', 'Scored 95% or higher on a case.', 'target',
   'silver', '{"type": "perfect_score"}', 300, 130),
  ('xp-5000', 'Five Thousand', 'Earned 5,000 XP.', 'sparkles',
   'silver', '{"type": "total_xp", "threshold": 5000}', 250, 140),
  ('xp-25000', 'Twenty Five K', 'Earned 25,000 XP.', 'gem',
   'platinum', '{"type": "total_xp", "threshold": 25000}', 2000, 150),

  ('contender', 'Contender', 'Entered 5 weekly contests.', 'swords',
   'bronze', '{"type": "contest_entries", "threshold": 5}', 200, 160),
  ('podium', 'Podium Finish', 'Finished top 3 in a weekly contest.', 'trophy',
   'platinum', '{"type": "contest_podium"}', 1500, 170)
on conflict (slug) do update
  set name        = excluded.name,
      description = excluded.description,
      icon        = excluded.icon,
      tier        = excluded.tier,
      criteria    = excluded.criteria,
      xp_reward   = excluded.xp_reward,
      sort_order  = excluded.sort_order;
