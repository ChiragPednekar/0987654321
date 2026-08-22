/**
 * Database types.
 *
 * Hand-maintained to match supabase/migrations. Once your project is linked you
 * can regenerate this file instead:
 *
 *   npm run db:types
 */

export type Domain =
  | "finance"
  | "consulting"
  | "product_management"
  | "marketing"
  | "strategy"
  | "operations";

export type Difficulty = "easy" | "medium" | "hard";
export type CaseFormat =
  | "framework"
  | "full_case"
  | "model"
  | "drill"
  | "debug";
export type UserRole = "student" | "admin" | "recruiter";
export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "evaluating"
  | "evaluated"
  | "failed";
export type CaseReportType =
  | "wrong_rubric"
  | "ambiguous_prompt"
  | "data_error"
  | "other";

export type NotificationType =
  | "grade_ready"
  | "badge_earned"
  | "level_up"
  | "contest_starting"
  | "contest_result"
  | "comment_reply"
  | "system";

export type ContestStatus = "scheduled" | "live" | "grading" | "completed";
export type LeaderboardPeriod = "all_time" | "weekly" | "monthly";
export type ActivityType =
  | "case_solved"
  | "case_attempted"
  | "badge_earned"
  | "level_up"
  | "contest_entered"
  | "path_step_completed";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Rubric weights, e.g. `{ financial_analysis: 20, market_analysis: 20 }`. */
export type RubricCriteria = Record<string, number>;

/** Per-criterion grading guidance handed to the model. Admin-only. */
export type RubricDescriptors = Record<string, string>;

export interface EvaluationFeedback {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
  career_goal: string | null;
  role: UserRole;
  ce: number;
  open_to_opportunities: boolean;
  plan: PlanTier;
  level: number;
  total_score: number;
  cases_solved: number;
  cases_attempted: number;
  current_streak: number;
  longest_streak: number;
  last_solved_on: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseCategoryRow = {
  id: string;
  slug: string;
  name: string;
  domain: Domain;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export type CaseRow = {
  id: string;
  slug: string;
  title: string;
  domain: Domain;
  difficulty: Difficulty;
  category_id: string | null;
  company_track: string | null;
  format: CaseFormat;
  /** The question style a firm is known for. Implies no affiliation. */
  firm_style: string | null;
  is_pro: boolean;
  estimated_minutes: number;
  scenario: string;
  /** jsonb object — metric blocks and tables shown alongside the scenario. */
  supporting_data: Record<string, unknown>;
  attachments: Attachment[];
  instructions: string;
  expected_framework: string | null;
  model_answer: string | null;
  tags: string[];
  is_published: boolean;
  created_by: string | null;
  total_submissions: number;
  total_solved: number;
  avg_score: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
}

export type RubricRow = {
  id: string;
  case_id: string;
  criteria: RubricCriteria;
  descriptors: RubricDescriptors;
  max_score: number;
  pass_score: number;
  created_at: string;
  updated_at: string;
}

/**
 * The sectioned answer format. Keys match ANSWER_SECTIONS in lib/constants so
 * the editor, the stored row and the history view cannot drift apart.
 */
export type AnswerSections = {
  framework?: string;
  analysis?: string;
  recommendation?: string;
};

export type DrillQuestionRow = {
  id: string;
  case_id: string;
  position: number;
  prompt: string;
  /** Withheld from anon/authenticated by column grant — server-side only. */
  expected: number;
  tolerance_pct: number;
  unit: string | null;
  explanation: string | null;
  created_at: string;
};

export type DrillAttemptRow = {
  id: string;
  user_id: string;
  case_id: string;
  answers: Record<string, number>;
  correct: number;
  total: number;
  duration_seconds: number;
  created_at: string;
};

export type CaseHintRow = {
  id: string;
  case_id: string;
  step: number;
  body: string;
  /** Percentage deducted from the final score if revealed. */
  penalty_pct: number;
  created_at: string;
};

export type HintRevealRow = {
  user_id: string;
  hint_id: string;
  case_id: string;
  revealed_at: string;
};

export type CaseReportRow = {
  id: string;
  case_id: string;
  user_id: string;
  type: CaseReportType;
  description: string;
  resolved: boolean;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** Always a path within the app, never an absolute URL. */
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type BookmarkRow = {
  user_id: string;
  case_id: string;
  created_at: string;
};

export type UniversityRow = {
  id: string;
  name: string;
  short_name: string | null;
  domain: string | null;
  country: string | null;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  user_id: string;
  case_id: string;
  contest_id: string | null;
  answer: string;
  /** Structured parts when the student used the sectioned editor; {} for free text. */
  answer_sections: AnswerSections;
  status: SubmissionStatus;
  attempt_number: number;
  time_spent_seconds: number;
  is_public: boolean;
  upvotes: number;
  error_message: string | null;
  created_at: string;
  submitted_at: string;
}

export type ScoreRow = {
  id: string;
  submission_id: string;
  user_id: string;
  case_id: string;
  breakdown: Record<string, number>;
  total_score: number;
  max_score: number;
  percentage: number;
  feedback: EvaluationFeedback;
  model: string | null;
  tokens_used: number | null;
  evaluated_at: string;
}

export type LearningPathRow = {
  id: string;
  slug: string;
  title: string;
  domain: Domain;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export type LearningPathStepRow = {
  id: string;
  path_id: string;
  case_id: string;
  step_order: number;
  title: string;
  unlock_threshold: number;
  created_at: string;
}

export type UserPathProgressRow = {
  id: string;
  user_id: string;
  path_id: string;
  completed_steps: number;
  current_step: number;
  completed_at: string | null;
  updated_at: string;
}

export type ContestRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  case_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  max_speed_bonus: number;
  status: ContestStatus;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type ContestSubmissionRow = {
  id: string;
  contest_id: string;
  user_id: string;
  submission_id: string | null;
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  base_score: number | null;
  speed_bonus: number;
  final_score: number | null;
  rank: number | null;
}

export type LeaderboardRow = {
  id: string;
  user_id: string;
  period: LeaderboardPeriod;
  period_start: string;
  period_end: string;
  total_points: number;
  cases_solved: number;
  accuracy: number;
  rank: number;
  updated_at: string;
}

export type CommentRow = {
  id: string;
  case_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  upvotes: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type BadgeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  criteria: Json;
  ce_reward: number;
  sort_order: number;
  created_at: string;
}

export type AchievementRow = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export type UserActivityRow = {
  id: string;
  user_id: string;
  type: ActivityType;
  case_id: string | null;
  metadata: Json;
  ce_delta: number;
  created_at: string;
}

export type DomainProgressRow = {
  user_id: string;
  domain: Domain;
  cases_solved: number;
  avg_percentage: number;
  total_points: number;
  last_solved_at: string;
}

export type UserCaseBestRow = {
  user_id: string;
  case_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  submission_id: string;
  evaluated_at: string;
}

export type CommentVoteRow = {
  comment_id: string;
  user_id: string;
  created_at: string;
}

export type SubmissionVoteRow = {
  submission_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Relationship metadata below mirrors the actual foreign keys in
 * supabase/migrations. supabase-js uses it to type embedded selects such as
 * `.select("*, rubrics(criteria)")` — without it those resolve to `never`.
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow>;
        Update: Partial<UserRow>;
        Relationships: [
          {
            foreignKeyName: "users_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "auth.users";
            referencedColumns: ["id"];
          },
        ];
      };
      model_cells: {
        Row: ModelCellRow;
        Insert: Partial<ModelCellRow>;
        Update: Partial<ModelCellRow>;
        Relationships: [];
      };
      model_attempts: {
        Row: ModelAttemptRow;
        Insert: Partial<ModelAttemptRow>;
        Update: Partial<ModelAttemptRow>;
        Relationships: [];
      };
      chat_sessions: {
        Row: ChatSessionRow;
        Insert: Partial<ChatSessionRow>;
        Update: Partial<ChatSessionRow>;
        Relationships: [];
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: Partial<ChatMessageRow>;
        Update: Partial<ChatMessageRow>;
        Relationships: [];
      };
      classrooms: {
        Row: ClassroomRow;
        Insert: Partial<ClassroomRow>;
        Update: Partial<ClassroomRow>;
        Relationships: [];
      };
      classroom_members: {
        Row: ClassroomMemberRow;
        Insert: Partial<ClassroomMemberRow>;
        Update: Partial<ClassroomMemberRow>;
        Relationships: [];
      };
      classroom_assignments: {
        Row: ClassroomAssignmentRow;
        Insert: Partial<ClassroomAssignmentRow>;
        Update: Partial<ClassroomAssignmentRow>;
        Relationships: [];
      };
      groups: {
        Row: GroupRow;
        Insert: Partial<GroupRow>;
        Update: Partial<GroupRow>;
        Relationships: [];
      };
      group_members: {
        Row: GroupMemberRow;
        Insert: Partial<GroupMemberRow>;
        Update: Partial<GroupMemberRow>;
        Relationships: [];
      };
      group_posts: {
        Row: GroupPostRow;
        Insert: Partial<GroupPostRow>;
        Update: Partial<GroupPostRow>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow>;
        Update: Partial<SubscriptionRow>;
        Relationships: [];
      };
      drill_questions: {
        Row: DrillQuestionRow;
        Insert: Partial<DrillQuestionRow>;
        Update: Partial<DrillQuestionRow>;
        Relationships: [];
      };
      drill_attempts: {
        Row: DrillAttemptRow;
        Insert: Partial<DrillAttemptRow>;
        Update: Partial<DrillAttemptRow>;
        Relationships: [];
      };
      case_hints: {
        Row: CaseHintRow;
        Insert: Partial<CaseHintRow>;
        Update: Partial<CaseHintRow>;
        Relationships: [];
      };
      hint_reveals: {
        Row: HintRevealRow;
        Insert: Partial<HintRevealRow>;
        Update: Partial<HintRevealRow>;
        Relationships: [];
      };
      case_reports: {
        Row: CaseReportRow;
        Insert: Partial<CaseReportRow>;
        Update: Partial<CaseReportRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      bookmarks: {
        Row: BookmarkRow;
        Insert: Partial<BookmarkRow>;
        Update: Partial<BookmarkRow>;
        Relationships: [];
      };
      universities: {
        Row: UniversityRow;
        Insert: Partial<UniversityRow>;
        Update: Partial<UniversityRow>;
        Relationships: [];
      };
      case_categories: {
        Row: CaseCategoryRow;
        Insert: Partial<CaseCategoryRow>;
        Update: Partial<CaseCategoryRow>;
        Relationships: [];
      };
      cases: {
        Row: CaseRow;
        Insert: Partial<CaseRow>;
        Update: Partial<CaseRow>;
        Relationships: [
          {
            foreignKeyName: "cases_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "case_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rubrics: {
        Row: RubricRow;
        Insert: Partial<RubricRow>;
        Update: Partial<RubricRow>;
        Relationships: [
          {
            foreignKeyName: "rubrics_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: true;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: SubmissionRow;
        Insert: Partial<SubmissionRow>;
        Update: Partial<SubmissionRow>;
        Relationships: [
          {
            foreignKeyName: "submissions_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_contest_id_fkey";
            columns: ["contest_id"];
            isOneToOne: false;
            referencedRelation: "contests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      scores: {
        Row: ScoreRow;
        Insert: Partial<ScoreRow>;
        Update: Partial<ScoreRow>;
        Relationships: [
          {
            foreignKeyName: "scores_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_paths: {
        Row: LearningPathRow;
        Insert: Partial<LearningPathRow>;
        Update: Partial<LearningPathRow>;
        Relationships: [];
      };
      learning_path_steps: {
        Row: LearningPathStepRow;
        Insert: Partial<LearningPathStepRow>;
        Update: Partial<LearningPathStepRow>;
        Relationships: [
          {
            foreignKeyName: "learning_path_steps_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_path_steps_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "learning_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      user_path_progress: {
        Row: UserPathProgressRow;
        Insert: Partial<UserPathProgressRow>;
        Update: Partial<UserPathProgressRow>;
        Relationships: [
          {
            foreignKeyName: "user_path_progress_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "learning_paths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_path_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      contests: {
        Row: ContestRow;
        Insert: Partial<ContestRow>;
        Update: Partial<ContestRow>;
        Relationships: [
          {
            foreignKeyName: "contests_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      contest_submissions: {
        Row: ContestSubmissionRow;
        Insert: Partial<ContestSubmissionRow>;
        Update: Partial<ContestSubmissionRow>;
        Relationships: [
          {
            foreignKeyName: "contest_submissions_contest_id_fkey";
            columns: ["contest_id"];
            isOneToOne: false;
            referencedRelation: "contests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contest_submissions_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contest_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboards: {
        Row: LeaderboardRow;
        Insert: Partial<LeaderboardRow>;
        Update: Partial<LeaderboardRow>;
        Relationships: [
          {
            foreignKeyName: "leaderboards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: CommentRow;
        Insert: Partial<CommentRow>;
        Update: Partial<CommentRow>;
        Relationships: [
          {
            foreignKeyName: "comments_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_votes: {
        Row: CommentVoteRow;
        Insert: Partial<CommentVoteRow>;
        Update: Partial<CommentVoteRow>;
        Relationships: [
          {
            foreignKeyName: "comment_votes_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      submission_votes: {
        Row: SubmissionVoteRow;
        Insert: Partial<SubmissionVoteRow>;
        Update: Partial<SubmissionVoteRow>;
        Relationships: [
          {
            foreignKeyName: "submission_votes_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submission_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      badges: {
        Row: BadgeRow;
        Insert: Partial<BadgeRow>;
        Update: Partial<BadgeRow>;
        Relationships: [];
      };
      achievements: {
        Row: AchievementRow;
        Insert: Partial<AchievementRow>;
        Update: Partial<AchievementRow>;
        Relationships: [
          {
            foreignKeyName: "achievements_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_activity: {
        Row: UserActivityRow;
        Insert: Partial<UserActivityRow>;
        Update: Partial<UserActivityRow>;
        Relationships: [
          {
            foreignKeyName: "user_activity_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_activity_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      domain_progress: { Row: DomainProgressRow; Relationships: [] };
      user_case_best: { Row: UserCaseBestRow; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      level_for_ce: { Args: { p_ce: number }; Returns: number };
      ce_for_level: { Args: { p_level: number }; Returns: number };
      refresh_leaderboards: { Args: Record<string, never>; Returns: undefined };
      sync_contest_statuses: { Args: Record<string, never>; Returns: undefined };
      finalize_contest: { Args: { p_contest_id: string }; Returns: number };
      award_badges: { Args: { p_user_id: string }; Returns: number };
      recalc_path_progress: { Args: { p_user_id: string }; Returns: undefined };
      compute_speed_bonus: {
        Args: {
          p_duration_seconds: number;
          p_limit_minutes: number;
          p_max_bonus: number;
        };
        Returns: number;
      };
    };
    Enums: {
      domain: Domain;
      difficulty: Difficulty;
      user_role: UserRole;
      submission_status: SubmissionStatus;
      contest_status: ContestStatus;
      leaderboard_period: LeaderboardPeriod;
      activity_type: ActivityType;
    };
    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------- §5 model --

export type ModelCellRow = {
  id: string;
  case_id: string;
  row_index: number;
  col_index: number;
  label: string;
  expected: number;
  tolerance_pct: number;
  unit: string | null;
  formula: string | null;
  explanation: string | null;
  created_at: string;
};

export type ModelAttemptRow = {
  id: string;
  user_id: string;
  case_id: string;
  cells: Json;
  correct: number;
  total: number;
  duration_seconds: number;
  created_at: string;
};

// ----------------------------------------------------------------- §6 chat --

export type ChatRole = "interviewer" | "candidate";

export type ChatSessionRow = {
  id: string;
  user_id: string;
  case_id: string;
  created_at: string;
  ended_at: string | null;
  verdict: string | null;
  score: number | null;
};

export type ChatMessageRow = {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};

// ------------------------------------------------------------ §11 classroom --

export type ClassroomRole = "teacher" | "student";

export type ClassroomRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  join_code: string;
  archived: boolean;
  created_at: string;
};

export type ClassroomMemberRow = {
  classroom_id: string;
  user_id: string;
  role: ClassroomRole;
  joined_at: string;
};

export type ClassroomAssignmentRow = {
  id: string;
  classroom_id: string;
  case_id: string;
  due_at: string | null;
  note: string | null;
  created_at: string;
};

// --------------------------------------------------------------- §10 groups --

export type GroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_private: boolean;
  member_count: number;
  created_at: string;
};

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  joined_at: string;
};

export type GroupPostRow = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  upvotes: number;
  created_at: string;
};

// ---------------------------------------------------------------- §16 billing --

export type PlanTier = "free" | "pro";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: PlanTier;
  status:
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired";
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};
