-- ============================================================================
-- CaseCode — open sign-up, and the things a student can buy
-- ============================================================================
-- 1. Anyone can create an account. 060 made the platform invite-only; the
--    owner now wants the opposite: sign up freely, then pay to practise. Every
--    AI feature is already behind can_solve()/has_pro(), so an open door hands
--    out reading, not model spend.
-- 2. Plans are periods of different lengths (monthly, season pass, annual),
--    each with its own allowance (src/lib/pricing.ts).
-- 3. `purchases` is the one order table: plans, top-up packs, certificate
--    exam attempts and expert mock interviews all go through it, so Razorpay
--    has one thing to reconcile against.
-- 4. Top-up credits, consumed one at a time when the plan's allowance or its
--    5-hour window is used up.
-- 5. Proctored certificate exams, with a public verification code.
-- 6. Paid mock interviews with approved experts; CaseCode keeps a commission.
--
-- Every new table is service-role only: the app renders and writes these
-- through route handlers that check the caller, and nothing here is meant to
-- be reachable straight through PostgREST.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Open sign-up.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created_check_access on auth.users;
drop function if exists public.reject_unlisted_signup();

-- Same signature, so every RESTRICTIVE policy and the middleware keep working.
-- "Has access" now means "is a live account": deactivation stays the switch
-- that takes everything away.
create or replace function public.has_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = p_user and u.deactivated_at is null
  );
$$;

comment on function public.has_access(uuid) is
  'True for any live (not deactivated) account. Sign-up is open (071); this
   used to read access_allowlist.';

grant execute on function public.has_access(uuid) to anon, authenticated, service_role;

-- The list no longer gates entry. It now names the accounts allowed to use the
-- demo checkout on production while Razorpay is not connected.
comment on table public.access_allowlist is
  'Demo-checkout testers: on production, only these addresses (and admins) may
   "pay" through the demo checkout before Razorpay is connected (071).';

-- ---------------------------------------------------------------------------
-- 2. Plans of different lengths.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists plan_code text,
  add column if not exists period_start timestamptz,
  add column if not exists purchase_id uuid;

update public.subscriptions
   set plan_code = coalesce(plan_code, 'annual'),
       period_start = coalesce(period_start,
         case when current_period_end is not null
              then current_period_end - interval '365 days'
              else created_at end);

alter table public.subscriptions drop constraint if exists subscriptions_plan_code_check;
alter table public.subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code is null or plan_code in ('monthly', 'season', 'annual'));

-- A period bought while another is running starts when that one ends, so "the
-- current plan" is the live period that has already started.
create or replace function public.has_active_subscription(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.status = 'active'
      and s.current_period_end is not null
      and s.current_period_end > now()
      and (s.period_start is null or s.period_start <= now())
  );
$$;

revoke all on function public.has_active_subscription(uuid) from public, anon, authenticated;
grant execute on function public.has_active_subscription(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Purchases.
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  kind                text not null check (kind in ('plan', 'topup', 'exam', 'expert_session')),
  item_code           text not null,
  item_ref            uuid,
  description         text not null,
  amount_paise        integer not null check (amount_paise > 0),
  currency            text not null default 'INR',
  status              text not null default 'created'
                      check (status in ('created', 'paid', 'failed', 'needs_refund', 'refunded')),
  source              text not null check (source in ('razorpay', 'demo')),
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  fulfilled_ref       uuid,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);

comment on table public.purchases is
  'Every order: plans, top-ups, exam attempts, expert sessions. source=demo rows
   moved no money and can be cleared when Razorpay goes live.';

-- ---------------------------------------------------------------------------
-- 4. Top-up credits.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  purchase_id uuid references public.purchases (id) on delete set null,
  kind        text not null check (kind in ('gradings', 'interviews')),
  amount      integer not null check (amount > 0),
  used        integer not null default 0 check (used >= 0),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  constraint usage_credits_not_overdrawn check (used <= amount)
);

create index if not exists usage_credits_user_idx
  on public.usage_credits (user_id, kind, expires_at);

-- One row per credit spent. Its timestamp is what lets the 5-hour window and
-- the plan allowance leave out uses a top-up paid for.
create table if not exists public.usage_credit_debits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  credit_id  uuid not null references public.usage_credits (id) on delete cascade,
  kind       text not null check (kind in ('gradings', 'interviews')),
  created_at timestamptz not null default now()
);

create index if not exists usage_credit_debits_user_idx
  on public.usage_credit_debits (user_id, created_at);

-- Spends one credit atomically: the earliest-expiring pack with any left.
-- Returns false when there is nothing to spend, so a race between two tabs
-- cannot overdraw (the row lock and the check constraint both hold the line).
create or replace function public.consume_usage_credit(p_user uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select c.id into v_id
    from public.usage_credits c
   where c.user_id = p_user
     and c.kind = p_kind
     and c.used < c.amount
     and c.expires_at > now()
   order by c.expires_at, c.granted_at
   limit 1
   for update skip locked;

  if v_id is null then
    return false;
  end if;

  update public.usage_credits set used = used + 1 where id = v_id;
  insert into public.usage_credit_debits (user_id, credit_id, kind)
  values (p_user, v_id, p_kind);
  return true;
end;
$$;

revoke all on function public.consume_usage_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_usage_credit(uuid, text) to service_role;

-- Every metered AI use since a moment, one row each, from the same tables
-- quota_status() counts (063). The 5-hour window and the plan period are both
-- worked out from this.
create or replace function public.ai_usage_since(p_user uuid, p_since timestamptz)
returns table(kind text, at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select 'gradings', s.evaluated_at from public.scores s
   where s.user_id = p_user and s.evaluated_at > p_since
  union all
  select 'gradings', r.created_at from public.resume_critiques r
   where r.user_id = p_user and r.created_at > p_since
  union all
  select 'gradings', d.created_at from public.deck_reviews d
   where d.user_id = p_user and d.created_at > p_since
  union all
  select case when e.feature = 'group_discussion' then 'interviews' else 'gradings' end, e.created_at
    from public.usage_events e
   where e.user_id = p_user
     and e.feature in ('competition_entry', 'simulation_debrief', 'group_discussion')
     and e.created_at > p_since
  union all
  select 'interviews', c.created_at from public.chat_sessions c
   where c.user_id = p_user and c.created_at > p_since
  union all
  select 'interviews', p.started_at from public.pi_sessions p
   where p.user_id = p_user and p.started_at > p_since
  union all
  select 'interviews', n.started_at from public.negotiation_sessions n
   where n.user_id = p_user and n.started_at > p_since
  union all
  select 'interviews', x.started_at from public.sales_sessions x
   where x.user_id = p_user and x.started_at > p_since;
$$;

revoke all on function public.ai_usage_since(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_usage_since(uuid, timestamptz) to service_role;

-- Certification grading is paid for by the exam attempt, so it is recorded
-- for cost but never counted against a plan.
alter table public.usage_events drop constraint if exists usage_events_feature_known;
alter table public.usage_events
  add constraint usage_events_feature_known
  check (feature is null or feature in (
    'competition_entry',
    'simulation_debrief',
    'group_discussion',
    'certification'
  ));

-- ---------------------------------------------------------------------------
-- 5. Certificate exams.
-- ---------------------------------------------------------------------------
create table if not exists public.cert_exams (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  track            text not null,
  summary          text not null,
  case_ids         uuid[] not null check (cardinality(case_ids) between 1 and 5),
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  pass_pct         integer not null default 60 check (pass_pct between 1 and 100),
  price_paise      integer not null check (price_paise > 0),
  is_published     boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.cert_attempts (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.cert_exams (id) on delete restrict,
  user_id          uuid not null references public.users (id) on delete cascade,
  purchase_id      uuid references public.purchases (id) on delete set null,
  status           text not null default 'ready'
                   check (status in ('ready', 'in_progress', 'graded', 'voided')),
  started_at       timestamptz,
  deadline_at      timestamptz,
  submitted_at     timestamptz,
  graded_at        timestamptz,
  total_score      numeric,
  max_score        numeric,
  percentage       numeric,
  passed           boolean,
  certificate_code text unique,
  void_reason      text,
  created_at       timestamptz not null default now()
);

create index if not exists cert_attempts_user_idx on public.cert_attempts (user_id, created_at desc);

create table if not exists public.cert_answers (
  attempt_id  uuid not null references public.cert_attempts (id) on delete cascade,
  case_id     uuid not null references public.cases (id) on delete restrict,
  answer      text not null,
  breakdown   jsonb,
  total_score numeric,
  max_score   numeric,
  percentage  numeric,
  feedback    jsonb,
  primary key (attempt_id, case_id)
);

alter type public.integrity_activity add value if not exists 'certification';

-- Three exams to start with, two cases each from the published library. An
-- exam whose track has no graded cases yet (a fresh local database, before
-- the seed) is skipped rather than created empty.
insert into public.cert_exams (slug, title, track, summary, case_ids, duration_minutes, pass_pct, price_paise, is_published)
select q.slug, q.title, q.track, q.summary, q.case_ids, 90, 60, 39900, true
  from (
    select x.slug, x.title, x.track, x.summary,
           (select array_agg(id) from (
              select c.id from public.cases c
               where c.is_published and c.domain::text = any (x.domains)
                 and exists (select 1 from public.rubrics r where r.case_id = c.id)
               order by (c.difficulty::text = 'medium') desc, c.created_at
               limit 2) picked) as case_ids
      from (values
        ('consulting-case-certificate', 'Consulting Case Solving', 'Consulting',
         'Two consulting cases under exam conditions: structure the problem, work the numbers, and make a recommendation a partner would sign.',
         array['consulting', 'strategy']),
        ('finance-case-certificate', 'Corporate Finance Cases', 'Finance',
         'Two finance cases under exam conditions: valuation, capital decisions and the trade-offs behind them.',
         array['finance']),
        ('product-marketing-certificate', 'Product & Marketing Cases', 'Product & Marketing',
         'Two product and marketing cases under exam conditions: users, positioning, metrics and a launch call.',
         array['product_management', 'marketing'])
      ) as x(slug, title, track, summary, domains)
  ) q
 where q.case_ids is not null
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Expert mock interviews.
-- ---------------------------------------------------------------------------
create table if not exists public.experts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.users (id) on delete cascade,
  display_name   text not null,
  headline       text not null,
  bio            text not null default '',
  expertise      text[] not null default '{}',
  linkedin_url   text,
  meeting_url    text,
  price_paise    integer not null default 150000 check (price_paise between 100000 and 500000),
  commission_bps integer not null default 2500 check (commission_bps between 0 and 10000),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  approved_at    timestamptz,
  approved_by    uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.expert_slots (
  id               uuid primary key default gen_random_uuid(),
  expert_id        uuid not null references public.experts (id) on delete cascade,
  starts_at        timestamptz not null,
  duration_minutes integer not null default 45 check (duration_minutes between 15 and 120),
  status           text not null default 'open' check (status in ('open', 'held', 'booked', 'cancelled')),
  held_by          uuid references public.users (id) on delete set null,
  held_until       timestamptz,
  created_at       timestamptz not null default now(),
  unique (expert_id, starts_at)
);

create index if not exists expert_slots_open_idx on public.expert_slots (expert_id, starts_at) where status <> 'cancelled';

create table if not exists public.expert_bookings (
  id               uuid primary key default gen_random_uuid(),
  slot_id          uuid not null unique references public.expert_slots (id) on delete restrict,
  expert_id        uuid not null references public.experts (id) on delete restrict,
  student_id       uuid not null references public.users (id) on delete cascade,
  purchase_id      uuid references public.purchases (id) on delete set null,
  price_paise      integer not null,
  commission_paise integer not null,
  payout_paise     integer not null,
  status           text not null default 'confirmed'
                   check (status in ('confirmed', 'completed', 'cancelled', 'no_show')),
  student_notes    text not null default '',
  expert_feedback  text,
  rating           integer check (rating between 1 and 5),
  review           text,
  payout_status    text not null default 'pending' check (payout_status in ('pending', 'paid')),
  paid_out_at      timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists expert_bookings_student_idx on public.expert_bookings (student_id, created_at desc);
create index if not exists expert_bookings_expert_idx on public.expert_bookings (expert_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Lock every new table to the service role.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'purchases', 'usage_credits', 'usage_credit_debits', 'cert_exams',
    'cert_attempts', 'cert_answers', 'experts', 'expert_slots', 'expert_bookings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end;
$$;
