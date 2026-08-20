-- A learning track per case category, for every domain.
--
-- The three original tracks (finance/consulting/product-management) were
-- hand-curated and keep their bespoke ordering. These are generated: one
-- track per category, which is a real skill boundary rather than an arbitrary
-- slice, and lets every domain have several tracks instead of one monolith.

insert into learning_paths (slug, title, domain, description, icon, sort_order, is_published)
select
  cc.slug || '-track',
  cc.name,
  cc.domain,
  coalesce(cc.description, 'Work through ' || cc.name || ' end to end.'),
  'route',
  100 + cc.sort_order,
  true
from case_categories cc
where exists (select 1 from cases c where c.category_id = cc.id and c.is_published)
  and not exists (select 1 from learning_paths lp where lp.slug = cc.slug || '-track')
on conflict (slug) do nothing;

-- Steps are rebuilt only for the generated tracks, easy first so each track is
-- an actual difficulty ramp rather than a shuffle.
with cat_tracks as (
  select lp.id as path_id, cc.id as category_id
  from learning_paths lp
  join case_categories cc on lp.slug = cc.slug || '-track'
),
deleted as (
  delete from learning_path_steps s
  using cat_tracks t where s.path_id = t.path_id
  returning 1
),
ordered as (
  select
    t.path_id,
    c.id as case_id,
    c.title,
    row_number() over (
      partition by t.path_id
      order by case c.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end,
               c.created_at
    ) as step_order
  from cat_tracks t
  join cases c on c.category_id = t.category_id and c.is_published
)
insert into learning_path_steps (path_id, case_id, step_order, title, unlock_threshold)
select path_id, case_id, step_order, left(title, 80), 60
from ordered
where step_order <= 12;
