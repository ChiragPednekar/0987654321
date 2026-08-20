insert into case_categories (slug, name, domain, description, sort_order) values
  ('supply-chain','Supply Chain & Network','operations','Network design, sourcing and distribution trade-offs',1),
  ('ops-excellence','Operations Excellence','operations','Throughput, quality and cost-to-serve',2),
  ('capacity-planning','Capacity & Footprint','operations','Make-vs-buy, plant footprint and utilisation',3),
  ('portfolio-strategy','Portfolio Strategy','strategy','Where to play across business units',4),
  ('platform-strategy','Platform & Ecosystem','strategy','Network effects and partner strategy',5),
  ('customer-acquisition','Customer Acquisition','marketing','Channel mix, CAC and payback',4),
  ('retention-loyalty','Retention & Loyalty','marketing','Churn, cohorts and lifetime value',5)
on conflict (slug) do nothing;
