-- ============================================================================
-- CaseCode — group discussions
-- ============================================================================
-- The GD is the round most Indian placement processes run first and no
-- platform practises well. Six to eight candidates, one topic, ten minutes,
-- and an evaluator scoring each of them separately on what they contributed to
-- a conversation nobody controlled.
--
-- THE HARD PROBLEM IS ATTRIBUTION, NOT VIDEO
--
-- Scoring a GD means knowing who said what. The obvious approach — record the
-- room and diarise the audio afterwards — is expensive, slow, and unreliable
-- exactly when it matters most, which is when two people talk over each other.
--
-- So attribution is established by construction instead. Every participant's
-- own browser transcribes their own microphone and posts the text tagged with
-- their session identity; the server takes the speaker from the authenticated
-- session, never from the request body. Nobody's speech is ever attributed by
-- guessing, and nobody can post an utterance as somebody else.
--
-- The cost of that choice is honest and visible: a browser without speech
-- recognition contributes no transcript, so that participant cannot be scored.
-- `gd_participants.transcription_ok` records it, and the result says "not
-- transcribed" rather than scoring them zero — a student who spoke well on an
-- unsupported browser must not be told they said nothing.
--
-- WHY ONE MODEL CALL, NOT ONE PER PERSON
--
-- A GD is judged comparatively: whether you led depends on whether anyone else
-- did. The whole attributed transcript goes to the model once and it scores
-- every participant together, which is both how a human evaluator does it and
-- roughly a sixth of the token cost.
-- ============================================================================

do $$ begin
  create type public.gd_status as enum ('open', 'live', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Topics.
-- ----------------------------------------------------------------------------
-- Its own table rather than a `cases` format. A GD topic is one sentence with
-- no scenario, no supporting data and no per-topic rubric — the rubric is the
-- same for every GD because it marks how you participated, not what the topic
-- was. Forcing it into `cases` would mean satisfying a scenario minimum and a
-- rubric that would be identical 200 times over.
create table if not exists public.gd_topics (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  prompt      text not null,
  -- 'abstract', 'business', 'social', 'case_based' — free text, because the
  -- useful categories are still being learned.
  category    text not null default 'business',
  difficulty  public.difficulty not null default 'medium',
  is_published boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.gd_topics is
  'One-line prompts for group discussions. The rubric is universal, so topics carry none.';

alter table public.gd_topics enable row level security;

drop policy if exists "published gd topics readable" on public.gd_topics;
create policy "published gd topics readable" on public.gd_topics
  for select using (is_published);

drop policy if exists "admins manage gd topics" on public.gd_topics;
create policy "admins manage gd topics" on public.gd_topics
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.gd_topics to authenticated;
grant select, insert, update, delete on public.gd_topics to service_role;

-- ----------------------------------------------------------------------------
-- A room.
-- ----------------------------------------------------------------------------
create table if not exists public.gd_sessions (
  id        uuid primary key default gen_random_uuid(),
  topic_id  uuid not null references public.gd_topics(id) on delete restrict,
  host_id   uuid not null references public.users(id) on delete cascade,
  status    public.gd_status not null default 'open',

  /**
   * Capped at six, and the cap is a real constraint rather than a preference.
   * The room is a WebRTC mesh — every participant holds a connection to every
   * other — so connections grow as n(n−1)/2 and both bandwidth and CPU climb
   * fast. Six is about where an ordinary laptop on Indian home broadband still
   * holds up, and a six-person GD is a realistic panel size. Going beyond it
   * needs a media server, which is a different piece of infrastructure.
   */
  max_participants int not null default 6
    check (max_participants between 2 and 6),

  prep_seconds       int not null default 120 check (prep_seconds between 0 and 600),
  discussion_seconds int not null default 600 check (discussion_seconds between 120 and 3600),

  started_at timestamptz,
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.gd_sessions is
  'One group discussion room. Capped at six by the WebRTC mesh, not by preference.';

create index if not exists gd_sessions_open_idx
  on public.gd_sessions (status, created_at desc) where status = 'open';
create index if not exists gd_sessions_host_idx on public.gd_sessions (host_id);

alter table public.gd_sessions enable row level security;

-- Open rooms are visible to everyone so they can be joined; a room you are in
-- stays visible once it is live.
drop policy if exists "gd sessions visible" on public.gd_sessions;
create policy "gd sessions visible" on public.gd_sessions
  for select using (
    status = 'open'
    or host_id = auth.uid()
    or exists (
      select 1 from public.gd_participants p
      where p.session_id = gd_sessions.id and p.user_id = auth.uid()
    )
  );

drop policy if exists "staff read gd sessions" on public.gd_sessions;
create policy "staff read gd sessions" on public.gd_sessions
  for select using (public.is_admin());

-- Rooms are created, joined and ended through routes that run as the service
-- role. A client that could update `status` could end everyone else's session.
revoke all on public.gd_sessions from anon, authenticated;
grant select on public.gd_sessions to authenticated;
grant select, insert, update, delete on public.gd_sessions to service_role;

-- ----------------------------------------------------------------------------
-- Who is in the room.
-- ----------------------------------------------------------------------------
create table if not exists public.gd_participants (
  session_id uuid not null references public.gd_sessions(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,

  /**
   * Whether this participant's browser could transcribe their own speech.
   *
   * Recorded rather than inferred from an empty transcript, because those two
   * cases mean opposite things: a student who said nothing should be told so,
   * and a student whose browser has no speech recognition must not be. Without
   * this column the second is indistinguishable from the first and would be
   * marked as silent.
   */
  transcription_ok boolean not null default false,

  primary key (session_id, user_id)
);

comment on table public.gd_participants is
  'Membership of a GD room. transcription_ok separates "said nothing" from "could not be heard".';

create index if not exists gd_participants_user_idx on public.gd_participants (user_id);

alter table public.gd_participants enable row level security;

drop policy if exists "gd participants visible to the room" on public.gd_participants;
create policy "gd participants visible to the room" on public.gd_participants
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.gd_participants me
      where me.session_id = gd_participants.session_id and me.user_id = auth.uid()
    )
  );

drop policy if exists "staff read gd participants" on public.gd_participants;
create policy "staff read gd participants" on public.gd_participants
  for select using (public.is_admin());

revoke all on public.gd_participants from anon, authenticated;
grant select on public.gd_participants to authenticated;
grant select, insert, update, delete on public.gd_participants to service_role;

-- ----------------------------------------------------------------------------
-- What was said.
-- ----------------------------------------------------------------------------
create table if not exists public.gd_utterances (
  id         bigserial primary key,
  session_id uuid not null references public.gd_sessions(id) on delete cascade,
  -- Always the authenticated poster. The route never reads a speaker id from
  -- the request body, so an utterance cannot be attributed to someone else.
  user_id    uuid not null references public.users(id) on delete cascade,
  text       text not null check (length(text) between 1 and 2000),
  said_at    timestamptz not null default now()
);

comment on table public.gd_utterances is
  'Attributed transcript. The speaker comes from the session, never from the client.';

create index if not exists gd_utterances_session_idx
  on public.gd_utterances (session_id, said_at);

alter table public.gd_utterances enable row level security;

-- Readable by the room, so the live transcript can be shown to everyone in it
-- and reviewed afterwards.
drop policy if exists "gd transcript visible to the room" on public.gd_utterances;
create policy "gd transcript visible to the room" on public.gd_utterances
  for select using (
    exists (
      select 1 from public.gd_participants p
      where p.session_id = gd_utterances.session_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "staff read gd transcript" on public.gd_utterances;
create policy "staff read gd transcript" on public.gd_utterances
  for select using (public.is_admin());

revoke all on public.gd_utterances from anon, authenticated;
grant select on public.gd_utterances to authenticated;
grant select, insert, update, delete on public.gd_utterances to service_role;

-- ----------------------------------------------------------------------------
-- The verdict, per participant.
-- ----------------------------------------------------------------------------
create table if not exists public.gd_scores (
  session_id uuid not null references public.gd_sessions(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,

  breakdown  jsonb not null default '{}'::jsonb,
  total      int not null default 0,
  max_score  int not null default 100,
  -- {strengths: [], weaknesses: [], verdict: ""} — the same shape as a case.
  feedback   jsonb not null default '{}'::jsonb,

  /**
   * Set when the participant produced no transcript at all. The distinction
   * from a low score is the whole reason this column exists: `silent` means
   * they did not speak, `not_transcribed` means we could not hear them, and
   * only the first is a judgement about the student.
   */
  outcome text not null default 'scored'
    check (outcome in ('scored', 'silent', 'not_transcribed')),

  words_spoken int not null default 0,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

comment on table public.gd_scores is
  'Per-participant GD result. `outcome` distinguishes silence from a failed transcript.';

create index if not exists gd_scores_user_idx on public.gd_scores (user_id, created_at desc);

alter table public.gd_scores enable row level security;

-- Everyone in the room sees everyone's score. That is deliberate: a GD is
-- judged comparatively, the other participants heard the same discussion, and
-- seeing where you placed against people who were in the room is most of the
-- learning. It is also what happens in a real GD result.
drop policy if exists "gd scores visible to the room" on public.gd_scores;
create policy "gd scores visible to the room" on public.gd_scores
  for select using (
    exists (
      select 1 from public.gd_participants p
      where p.session_id = gd_scores.session_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "staff read gd scores" on public.gd_scores;
create policy "staff read gd scores" on public.gd_scores
  for select using (public.is_admin());

revoke all on public.gd_scores from anon, authenticated;
grant select on public.gd_scores to authenticated;
grant select, insert, update, delete on public.gd_scores to service_role;
