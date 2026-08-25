-- §8 recruiter view needs a role to gate on. Added rather than reusing 'admin',
-- so a recruiter cannot also edit cases.
--
-- Applied to production as `recruiter_role` on 2026-08-22; committed here so a
-- database rebuilt from this directory matches.

do $$ begin
  alter type public.user_role add value if not exists 'recruiter';
exception when duplicate_object then null; end $$;
