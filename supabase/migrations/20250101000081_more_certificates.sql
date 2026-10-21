-- Four more certificate exams, each with a prep course in
-- src/lib/cert-courses-more.ts. Every exam is two cases the course never
-- recommends (pinned in tests/cert-courses.test.ts). Inserted only when both
-- cases exist with a rubric, so a database without the case library seeded
-- simply gets no row rather than a broken exam.

insert into public.cert_exams (slug, title, track, summary, case_ids, duration_minutes, pass_pct, price_paise, is_published)
select x.slug, x.title, x.track, x.summary,
       array(select c.id from public.cases c where c.slug = any (x.case_slugs) order by c.slug),
       x.minutes, 60, 39900, true
  from (values
    ('operations-supply-chain-certificate', 'Operations & Supply Chain Cases', 'Operations',
     'Two operations cases under exam conditions: a make-or-buy decision and a supply-risk problem, worked to a number and a recommendation.',
     array['make-vs-buy-12', 'dual-sourcing-13'], 90),
    ('marketing-brand-certificate', 'Marketing & Brand Management Cases', 'Marketing',
     'Two marketing cases under exam conditions: where the acquisition budget should go, and a launch against an incumbent.',
     array['channel-mix-12', 'gtm-launch-12'], 90),
    ('business-strategy-certificate', 'Business Strategy Cases', 'Strategy',
     'Two strategy cases under exam conditions: responding to a discount entrant, and deciding which businesses deserve capital.',
     array['competitive-response-14', 'portfolio-review-12'], 100),
    ('mbb-case-interview-certificate', 'MBB Case Interview', 'Consulting',
     'Two hard MBB-style cases under exam conditions: one interviewer-led, one candidate-led, each closed with a recommendation.',
     array['mbb-mckinsey-hard-3', 'mbb-bcg-hard-3'], 110)
  ) as x(slug, title, track, summary, case_slugs, minutes)
 where (select count(*) from public.cases c
         where c.slug = any (x.case_slugs) and c.is_published
           and exists (select 1 from public.rubrics r where r.case_id = c.id)) = 2
on conflict (slug) do nothing;
