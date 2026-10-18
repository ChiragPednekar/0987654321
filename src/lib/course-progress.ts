import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getCertCourse } from "@/lib/cert-courses";

type Admin = SupabaseClient<Database>;

/**
 * Progress through a certificate prep course (migration 075).
 *
 * A module is done when its knowledge check is passed; the course is done when
 * every module is. The exam cannot be bought or started before that
 * (src/lib/billing/purchases.ts). An exam with no course has nothing to finish.
 */

export interface CourseProgress {
  passed: string[];
  total: number;
  complete: boolean;
}

export async function getCourseProgress(admin: Admin, userId: string, examSlug: string): Promise<CourseProgress> {
  const course = getCertCourse(examSlug);
  if (!course) return { passed: [], total: 0, complete: true };

  const { data } = await admin
    .from("course_progress")
    .select("module_id")
    .eq("user_id", userId)
    .eq("exam_slug", examSlug)
    .eq("passed", true);

  const moduleIds = new Set(course.modules.map((m) => m.id));
  const passed = (data ?? []).map((r) => r.module_id).filter((id) => moduleIds.has(id));
  return { passed, total: moduleIds.size, complete: passed.length >= moduleIds.size };
}
