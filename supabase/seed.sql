-- Seed Domains / Categories
INSERT INTO domains (id, name) VALUES
(1, 'Finance'),
(2, 'Consulting'),
(3, 'PM'),
(4, 'Marketing'),
(5, 'Strategy')
ON CONFLICT (id) DO NOTHING;

-- Seed Badges
INSERT INTO badges (id, name, description, icon_url) VALUES
(1, 'First Steps', 'Completed your first case', '/badges/first-steps.png'),
(2, '3-Day Streak', 'Solved cases 3 days in a row', '/badges/streak-3.png'),
(3, 'Consulting Whiz', 'Scored above 8.5 on 5 Consulting cases', '/badges/consulting-whiz.png'),
(4, 'Finance Guru', 'Completed all Finance learning path steps', '/badges/finance-guru.png'),
(5, 'PM Master', 'Completed all PM learning path steps', '/badges/pm-master.png'),
(6, 'Speed Demon', 'Finished a contest case in under 30 minutes', '/badges/speed-demon.png'),
(7, 'Top 10%', 'Placed in the top 10% in a weekly contest', '/badges/top-10.png'),
(8, 'Community Star', 'Received 50 upvotes on your solutions', '/badges/community-star.png'),
(9, 'Weekend Warrior', 'Solved 5 cases during the weekend', '/badges/weekend-warrior.png'),
(10, 'Perfect Score', 'Received a 10/10 from the AI grader', '/badges/perfect-score.png')
ON CONFLICT (id) DO NOTHING;

-- Note: 300 pre-generated cases from v1 need to be injected here
-- Format example:
-- INSERT INTO cases (title, domain_id, difficulty, company_track, scenario, instructions, rubric) VALUES ...
