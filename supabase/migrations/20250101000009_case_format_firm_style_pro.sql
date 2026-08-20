-- Case format, firm style, and the paid-plan flag.

do $$ begin
  create type case_format as enum ('framework','full_case','model','drill','debug');
exception when duplicate_object then null; end $$;

alter table public.cases
  add column if not exists format case_format not null default 'full_case',
  add column if not exists firm_style text,
  add column if not exists is_pro boolean not null default false;

comment on column public.cases.firm_style is
  'Describes the question style a firm is known for. Implies no affiliation.';
comment on column public.cases.is_pro is
  'Gated behind a paid plan. Left false everywhere until billing is live.';

create index if not exists cases_format_idx on public.cases(format) where is_published;
create index if not exists cases_firm_style_idx on public.cases(firm_style) where is_published;

update public.cases set firm_style = case
  when company_track in ('McKinsey','BCG','Bain') then 'MBB-style'
  when company_track in ('Goldman Sachs','Morgan Stanley') then 'Investment Banking-style'
  when company_track in ('Amazon','Google') then 'Big Tech PM-style'
  when company_track in ('Stripe','Flipkart','Razorpay') then 'Startup-style'
  else firm_style
end
where firm_style is null and company_track is not null;
