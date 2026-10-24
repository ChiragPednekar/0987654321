import type { Json } from "@/lib/types/database";

export type PreparationProfile = {
  user_id: string; target_role: string; specialisation: string; programme: string;
  graduation_year: number | null; placement_date: string | null; resume_url: string;
  share_contact: boolean; share_resume: boolean; updated_at: string;
};
export type PlacementAssessment = {
  id: string; institution_id: string; title: string; target_role: string; domain: string;
  scenario: string; criteria: Record<string, number>; reference_answer: string;
  examples: { level: string; answer: string; explanation: string }[];
  status: "draft" | "open" | "closed"; closes_at: string | null; created_by: string; created_at: string;
};
export type PracticeResult = {
  breakdown: Record<string, number>; percentage: number;
  feedback: { strengths: string[]; weaknesses: string[]; improvements: string[]; verdict: string };
};
export type PlacementAttempt = {
  id: string; assessment_id: string | null; diagnostic_key: string | null; user_id: string;
  answer: string; status: "processing" | "evaluated" | "failed"; result: PracticeResult | null;
  created_at: string; evaluated_at: string | null;
  /** Common assessments only; null for the diagnostic and for attempts before proctoring. */
  integrity: AttemptIntegrity | null; elapsed_seconds: number | null;
};
export type AttemptIntegrity = {
  severity: "clean" | "suspect" | "severe";
  flags: { code: string; label: string; points: number }[];
  camera: "on" | "denied" | "unavailable" | "failed";
};
export type PlacementReview = {
  id: string; attempt_id: string; reviewer_id: string; scores: Record<string, number>;
  percentage: number; feedback: string; reason: string; created_at: string;
};
export type PlacementRequest = {
  id: string; institution_id: string; requester_id: string; company: string;
  target_role: string; requirements: string; status: "open" | "fulfilled" | "closed"; created_at: string;
};
export type PlacementReport = {
  id: string; institution_id: string; request_id: string | null; title: string;
  recipient_email: string; student_ids: string[]; assessment_ids: string[];
  include_work: boolean; include_feedback: boolean; include_contact: boolean; include_resume: boolean;
  status: "draft" | "shared" | "revoked"; token_hash: string | null; expires_at: string | null;
  created_by: string; approved_at: string | null; created_at: string;
};
export type InterviewRequest = {
  id: string; report_id: string; requester_id: string; student_ids: string[]; message: string;
  status: "requested" | "contacted" | "closed"; created_at: string;
};
export type Defense = {
  id: string; user_id: string; submission_id: string | null; topic: string;
  answer: string; follow_up: string; response: string; input_mode: "spoken" | "typed";
  result: PracticeResult | null; status: "processing" | "evaluated" | "failed"; created_at: string;
};
export type GdReview = {
  id: string; session_id: string; user_id: string; reviewer_id: string;
  scores: Record<string, number>; feedback: string; created_at: string;
};
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type PlacementTables = {
  preparation_profiles: Table<PreparationProfile>;
  preparation_tasks: Table<{ user_id: string; week_start: string; task_key: string; completed_at: string }>;
  placement_assessments: Table<PlacementAssessment>;
  placement_attempts: Table<PlacementAttempt>;
  placement_reviews: Table<PlacementReview>;
  placement_requests: Table<PlacementRequest>;
  placement_reports: Table<PlacementReport>;
  placement_interview_requests: Table<InterviewRequest>;
  practice_defenses: Table<Defense>;
  placement_sittings: Table<{ assessment_id: string; user_id: string; started_at: string }>;
  gd_faculty_reviews: Table<GdReview>;
  assignment_review_history: Table<{ id: string; assignment_submission_id: string; previous: Json; revised: Json; created_at: string }>;
};
