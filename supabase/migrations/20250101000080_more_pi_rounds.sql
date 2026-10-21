-- Eight more personal-interview rounds. The interviewer's brief for each is in
-- src/lib/ai/pi-interview.ts; the labels in src/lib/pi.ts.
alter type public.pi_kind add value if not exists 'behavioural';
alter type public.pi_kind add value if not exists 'career_goals';
alter type public.pi_kind add value if not exists 'academics';
alter type public.pi_kind add value if not exists 'current_affairs';
alter type public.pi_kind add value if not exists 'situational';
alter type public.pi_kind add value if not exists 'red_flags';
alter type public.pi_kind add value if not exists 'interests';
alter type public.pi_kind add value if not exists 'partner';
