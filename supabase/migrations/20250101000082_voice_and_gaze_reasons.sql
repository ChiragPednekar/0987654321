-- Store "voice" and "looking away" as themselves.
--
-- The lockout reason and the evidence-photo kind were each constrained to the
-- camera findings that existed when they were made, so when looking-away and
-- voice detection arrived the code stored them under the nearest allowed word:
-- a voice ending became "multiple_faces" and a voice recording a
-- "multiple_faces" photo. A teacher reviewing a student who was flagged for
-- speaking was told "another person was seen" — a different and more serious
-- accusation. The real reason was kept in signals->>'violation', so it can be
-- put back.

alter table public.exam_lockouts drop constraint if exists exam_lockouts_reason_check;
alter table public.exam_lockouts
  add constraint exam_lockouts_reason_check
  check (reason in ('phone', 'multiple_faces', 'camera_covered', 'no_face', 'camera_off', 'tab_switch',
                    'looking_away', 'voice_detected'));

update public.exam_lockouts
   set reason = signals->>'violation'
 where signals->>'violation' in ('looking_away', 'voice_detected')
   and reason is distinct from signals->>'violation';

alter table public.proctor_snapshots drop constraint if exists proctor_snapshots_kind_check;
alter table public.proctor_snapshots
  add constraint proctor_snapshots_kind_check
  check (kind in ('phone', 'multiple_faces', 'no_face', 'book', 'looking_away', 'voice_detected', 'voice_audio'));

-- Recordings were filed as photos of another person; the file type says what they are.
update public.proctor_snapshots
   set kind = 'voice_audio'
 where kind = 'multiple_faces'
   and (storage_path like '%.webm' or storage_path like '%.m4a');
