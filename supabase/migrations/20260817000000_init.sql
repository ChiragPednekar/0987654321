-- Users extension (linked to auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  university TEXT,
  career_goal TEXT,
  current_level TEXT,
  target_role TEXT,
  score INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Domains / Categories
CREATE TABLE domains (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL, -- 'Finance', 'Consulting', 'PM', 'Marketing', 'Strategy'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Cases
CREATE TABLE cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  domain_id INTEGER REFERENCES domains(id),
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  company_track TEXT,
  company_style TEXT, -- e.g., 'McKinsey-style', 'BCG-style'
  estimated_time INTEGER, -- in minutes
  scenario TEXT NOT NULL,
  supporting_data TEXT,
  instructions TEXT NOT NULL,
  expected_framework TEXT,
  model_answer TEXT,
  rubric JSONB,
  completion_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Submissions
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  attempt_number INTEGER DEFAULT 1,
  unstructured_answer TEXT,
  structured_answer JSONB,
  score NUMERIC,
  ai_feedback JSONB,
  confidence_flag BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contests
CREATE TABLE contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contest Participants
CREATE TABLE contest_participants (
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0,
  PRIMARY KEY (contest_id, user_id)
);

-- Case Comments / Discussion
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Badges
CREATE TABLE badges (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT
);

-- User Badges
CREATE TABLE user_badges (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

-- User Saved/Bookmarked Cases
CREATE TABLE saved_cases (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, case_id)
);

-- Learning Paths
CREATE TABLE learning_paths (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  domain_id INTEGER REFERENCES domains(id),
  is_custom BOOLEAN DEFAULT false,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE -- null if global
);

-- Learning Path Steps
CREATE TABLE learning_path_steps (
  id SERIAL PRIMARY KEY,
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  unlock_score_threshold INTEGER DEFAULT 0
);
