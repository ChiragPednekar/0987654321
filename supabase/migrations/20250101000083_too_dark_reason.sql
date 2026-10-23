-- A room too dark to see the student ends the attempt (src/lib/camera-proctor.ts,
-- TOO_DARK_END_MS). Its own reason and its own evidence photo kind, so a
-- reviewer reads "too dark", not "covered" or "nobody there".

alter table public.exam_lockouts drop constraint if exists exam_lockouts_reason_check;
alter table public.exam_lockouts
  add constraint exam_lockouts_reason_check
  check (reason in ('phone', 'multiple_faces', 'camera_covered', 'no_face', 'camera_off', 'tab_switch',
                    'looking_away', 'voice_detected', 'too_dark'));

alter table public.proctor_snapshots drop constraint if exists proctor_snapshots_kind_check;
alter table public.proctor_snapshots
  add constraint proctor_snapshots_kind_check
  check (kind in ('phone', 'multiple_faces', 'no_face', 'book', 'looking_away', 'voice_detected', 'voice_audio',
                  'too_dark'));
