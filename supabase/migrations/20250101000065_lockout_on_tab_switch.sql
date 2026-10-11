-- ============================================================================
-- CaseCode — leaving the test window ends the test too
-- ============================================================================
-- 064 let the camera end a test. Switching tabs, or moving to another window
-- for more than a moment, now does the same (src/hooks/use-proctor.ts), and is
-- stored with the same lock so a reload does not undo it.
-- ============================================================================

alter table public.exam_lockouts
  drop constraint if exists exam_lockouts_reason_check;

alter table public.exam_lockouts
  add constraint exam_lockouts_reason_check
  check (reason in ('phone', 'multiple_faces', 'camera_covered', 'no_face', 'camera_off', 'tab_switch'));
