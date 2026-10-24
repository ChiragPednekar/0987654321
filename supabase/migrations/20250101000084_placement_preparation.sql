-- Private learning and explicitly reviewed recruitment evidence are separate.
-- All access is through authenticated, institution-scoped server handlers.
create table public.preparation_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  target_role text not null default '', specialisation text not null default '',
  programme text not null default '', graduation_year integer check (graduation_year between 2000 and 2100),
  placement_date date, resume_url text not null default '',
  share_contact boolean not null default false, share_resume boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.preparation_tasks (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null, task_key text not null, completed_at timestamptz not null default now(),
  primary key (user_id, week_start, task_key)
);
create table public.placement_assessments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null, target_role text not null, domain text not null,
  scenario text not null, criteria jsonb not null, reference_answer text not null,
  examples jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','open','closed')),
  closes_at timestamptz, created_by uuid not null references public.users(id), created_at timestamptz not null default now()
);
create table public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.placement_assessments(id) on delete cascade,
  diagnostic_key text, user_id uuid not null references public.users(id) on delete cascade,
  answer text not null, status text not null default 'processing' check (status in ('processing','evaluated','failed')),
  result jsonb, created_at timestamptz not null default now(), evaluated_at timestamptz,
  check ((assessment_id is null) <> (diagnostic_key is null)),
  unique (assessment_id, user_id), unique (diagnostic_key, user_id)
);
create table public.placement_reviews (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.placement_attempts(id) on delete cascade,
  reviewer_id uuid not null references public.users(id), scores jsonb not null,
  percentage numeric not null check (percentage between 0 and 100), feedback text not null,
  reason text not null, created_at timestamptz not null default now()
);
create table public.placement_requests (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
  requester_id uuid not null references public.users(id), company text not null,
  target_role text not null, requirements text not null,
  status text not null default 'open' check (status in ('open','fulfilled','closed')), created_at timestamptz not null default now()
);
create table public.placement_reports (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
  request_id uuid references public.placement_requests(id), title text not null, recipient_email text not null,
  student_ids uuid[] not null, assessment_ids uuid[] not null,
  include_work boolean not null default false, include_feedback boolean not null default true,
  include_contact boolean not null default false, include_resume boolean not null default false,
  status text not null default 'draft' check (status in ('draft','shared','revoked')),
  token_hash text unique, expires_at timestamptz, created_by uuid not null references public.users(id),
  approved_at timestamptz, created_at timestamptz not null default now()
);
create table public.placement_interview_requests (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.placement_reports(id) on delete cascade,
  requester_id uuid not null references public.users(id), student_ids uuid[] not null, message text not null,
  status text not null default 'requested' check (status in ('requested','contacted','closed')), created_at timestamptz not null default now()
);
create table public.practice_defenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  topic text not null, answer text not null, follow_up text not null, response text not null,
  input_mode text not null check (input_mode in ('spoken','typed')), result jsonb,
  status text not null default 'processing' check (status in ('processing','evaluated','failed')), created_at timestamptz not null default now()
);
create table public.gd_faculty_reviews (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.gd_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade, reviewer_id uuid not null references public.users(id),
  scores jsonb not null, feedback text not null, created_at timestamptz not null default now()
);
create table public.assignment_review_history (
  id uuid primary key default gen_random_uuid(), assignment_submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  previous jsonb not null, revised jsonb not null, created_at timestamptz not null default now()
);
create function public.archive_assignment_review() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (old.faculty_marks,old.faculty_remarks,old.reviewed_at) is distinct from (new.faculty_marks,new.faculty_remarks,new.reviewed_at) then
    insert into public.assignment_review_history(assignment_submission_id,previous,revised)
    values(new.id,to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end; $$;

create function public.reserve_practice_defense(p_user uuid,p_topic text,p_answer text,p_response text,p_follow_up text,p_input_mode text,p_submission uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('defense:'||p_user::text,0));
  if (select count(*) from public.practice_defenses where user_id=p_user and created_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc') >= 2 then return null; end if;
  insert into public.practice_defenses(user_id,topic,answer,response,follow_up,input_mode,submission_id)
  values(p_user,p_topic,p_answer,p_response,p_follow_up,p_input_mode,p_submission) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.reserve_practice_defense(uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_practice_defense(uuid,text,text,text,text,text,uuid) to service_role;
create trigger archive_assignment_review after update on public.assignment_submissions
for each row execute function public.archive_assignment_review();
revoke all on function public.archive_assignment_review() from public, anon, authenticated;

create index placement_assessments_institution on public.placement_assessments(institution_id,created_at desc);
create index placement_attempts_user on public.placement_attempts(user_id,created_at desc);
create index placement_reviews_attempt on public.placement_reviews(attempt_id,created_at desc);
create index placement_reports_institution on public.placement_reports(institution_id,created_at desc);
create index practice_defenses_user on public.practice_defenses(user_id,created_at desc);
create index gd_faculty_reviews_user on public.gd_faculty_reviews(user_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['preparation_profiles','preparation_tasks','placement_assessments','placement_attempts','placement_reviews','placement_requests','placement_reports','placement_interview_requests','practice_defenses','gd_faculty_reviews','assignment_review_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end; $$;
