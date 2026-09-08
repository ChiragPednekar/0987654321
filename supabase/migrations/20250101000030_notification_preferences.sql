-- ============================================================================
-- CaseCode — one notification preference that is actually honoured
-- ============================================================================
-- The settings page offered four notification toggles and answered
-- "Notification preferences updated." to each. All four wrote to localStorage
-- and nothing else, so the server never heard about any of them.
--
-- Auditing what the four could even control:
--
--   Classroom & assignment deadlines — real. Six routes insert notifications
--     when an assignment is set, graded, returned, or a student is enrolled.
--     None of them checked a preference, so switching this off changed
--     nothing.
--   Cohort & study group posts       — nothing in the codebase creates a
--     notification for a group post.
--   Daily practice streak reminder   — an "evening nudge" needs a scheduled
--     job and a delivery channel. Neither exists.
--   Weekly performance digest        — needs email. There is no mail provider
--     in the project at all; notifications are in-app only.
--
-- So one of the four was ignored and three described a product that does not
-- exist. This adds the column for the one that is real. The other three are
-- removed from the interface rather than left switchable, because a control
-- that cannot ever take effect teaches people their settings do not matter.
--
-- Default true preserves today's behaviour: everyone currently gets these.
-- ============================================================================

alter table public.users
  add column if not exists notify_assignments boolean not null default true;

-- Readable so the settings page can render real state; written only through
-- /api/settings/notifications, which proves the caller owns the row.
-- 20250101000004 governs which columns `authenticated` may update, and this is
-- deliberately not among them.
grant select (notify_assignments) on public.users to anon, authenticated;

comment on column public.users.notify_assignments is
  'In-app notifications for assignments set, graded, returned, and enrolment.';
