import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMMON_CRITERIA, DIAGNOSTIC_KEY, roleDomain, weekStart } from "./core";
import { allRows } from "./server";
import { DOMAIN_LABEL } from "@/lib/constants";
import type { PlacementAttempt, PreparationProfile } from "./types";

export type NextStep = { title: string; href: string; reason: string; minutes: string };
export type PlanItem = NextStep & { key: "case" | "spoken" | "skills" | "gd" };

/**
 * One answer to "what should I do now?", shared by the dashboard card and the
 * preparation page so they never disagree. Order of precedence: work a teacher
 * set (it has a deadline), then the baseline (everything else is guesswork
 * without it), then an open college assessment, then the weekly plan.
 */
export async function preparationState(userId: string) {
  const db = createAdminClient();
  const now = Date.now();

  const [{ data: profile }, { data: diagnostic }, { data: tasks }, memberships, batches, { data: domains }] =
    await Promise.all([
      db.from("preparation_profiles").select("*").eq("user_id", userId).maybeSingle(),
      db.from("placement_attempts").select("*").eq("user_id", userId).eq("diagnostic_key", DIAGNOSTIC_KEY).maybeSingle(),
      db.from("preparation_tasks").select("task_key").eq("user_id", userId).eq("week_start", weekStart()),
      allRows((a, b) => db.from("institution_members").select("institution_id").eq("user_id", userId).eq("role", "student").order("institution_id").range(a, b)),
      allRows((a, b) => db.from("classroom_members").select("classroom_id").eq("user_id", userId).eq("role", "student").order("classroom_id").range(a, b)),
      db.from("domain_progress").select("domain, avg_percentage, cases_solved").eq("user_id", userId),
    ]);

  const assignments = batches.length
    ? await allRows((a, b) =>
        db.from("classroom_assignments").select("id, title, classroom_id, due_at, starts_at")
          .in("classroom_id", batches.map((x) => x.classroom_id)).eq("is_published", true)
          .order("due_at", { nullsFirst: false }).order("id").range(a, b))
    : [];
  const { data: handins } = await db.from("assignment_submissions").select("assignment_id, status").eq("user_id", userId);
  const pendingAssignments = assignments.filter((a) => {
    if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
    const mine = handins?.filter((h) => h.assignment_id === a.id) ?? [];
    return mine.length === 0 || mine.some((h) => h.status === "resubmission_requested");
  });

  const assessments = memberships.length
    ? await allRows((a, b) =>
        db.from("placement_assessments").select("id, title, status, closes_at")
          .in("institution_id", memberships.map((m) => m.institution_id)).neq("status", "draft")
          .order("created_at", { ascending: false }).order("id").range(a, b))
    : [];
  const { data: myAttempts } = assessments.length
    ? await db.from("placement_attempts").select("assessment_id, status").eq("user_id", userId).in("assessment_id", assessments.map((a) => a.id))
    : { data: [] as { assessment_id: string | null; status: string }[] };
  const openAssessments = assessments.filter(
    (a) => a.status === "open" && (!a.closes_at || new Date(a.closes_at).getTime() > now) &&
      !myAttempts?.some((x) => x.assessment_id === a.id),
  );

  const p = profile as PreparationProfile | null;
  const d = diagnostic as PlacementAttempt | null;
  const domain = roleDomain(p?.target_role);
  const weakestCriterion = d?.result
    ? Object.entries(COMMON_CRITERIA).sort(([a, am], [b, bm]) => (d.result!.breakdown[a] ?? 0) / am - (d.result!.breakdown[b] ?? 0) / bm)[0]?.[0] ?? null
    : null;
  // The weakest area they have actually practised, once there are a few answers to go on.
  const weakestDomain = (domains ?? []).filter((x) => x.cases_solved >= 2).sort((a, b) => a.avg_percentage - b.avg_percentage)[0];

  const { data: cases } = await db.from("cases").select("id, slug, title, estimated_minutes")
    .eq("is_published", true).eq("domain", weakestDomain && weakestDomain.avg_percentage < 60 ? weakestDomain.domain : domain)
    .in("format", ["full_case", "framework", "guesstimate", "memo"]).lte("estimated_minutes", 25)
    .order("estimated_minutes").limit(40);
  const { data: done } = await db.from("submissions").select("case_id").eq("user_id", userId).eq("status", "evaluated");
  const doneIds = new Set((done ?? []).map((x) => x.case_id));
  const nextCase = cases?.find((c) => !doneIds.has(c.id)) ?? cases?.[0];

  const role = p?.target_role || "your target role";
  const caseReason =
    weakestDomain && weakestDomain.avg_percentage < 60
      ? `${DOMAIN_LABEL[weakestDomain.domain]} is your weakest area so far (${Math.round(weakestDomain.avg_percentage)}% average). A fresh case there moves you most.`
      : weakestCriterion
        ? `Your baseline was weakest on ${weakestCriterion.replaceAll("_", " ")}. Focus on that in this case, then explain your conclusion aloud.`
        : `A short case relevant to ${role}. Focus on a clear, evidenced recommendation.`;

  const plan: PlanItem[] = [
    { key: "case", title: nextCase?.title ?? "Practise a business case", href: nextCase ? `/cases/${nextCase.slug}` : "/cases", reason: caseReason, minutes: `${nextCase?.estimated_minutes ?? 15}–20 min` },
    { key: "spoken", title: "Defend your recommendation aloud", href: "/preparation#spoken", reason: "Explain the decision in 90 seconds, then handle a changed assumption — what interviewers actually test.", minutes: "10 min" },
    domain === "marketing"
      ? { key: "skills", title: "Practise a sales conversation", href: "/sales", reason: "Turn your reasoning into a conversation with a buyer.", minutes: "15 min" }
      : { key: "skills", title: "Practise an Excel exercise", href: "/excel", reason: `The spreadsheet work ${role} interviews ask for.`, minutes: "15 min" },
    { key: "gd", title: "Join a group discussion", href: "/gd", reason: "Practise listening, building on others' points and contributing clearly.", minutes: "20 min" },
  ];

  let next: NextStep;
  const assignment = pendingAssignments[0];
  if (assignment) {
    next = {
      title: assignment.title ?? "Your teacher's assignment",
      href: `/classrooms/${assignment.classroom_id}`,
      reason: `Set by your teacher${assignment.due_at ? `, due ${new Date(assignment.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}. Assignments come first so you never juggle two task lists.`,
      minutes: "varies",
    };
  } else if (!p?.target_role) {
    next = { title: "Tell us the role you are preparing for", href: "/preparation", reason: "Your target role, specialisation and placement date decide which cases, skills and timeline your plan uses. Takes a minute.", minutes: "1 min" };
  } else if (d?.status !== "evaluated") {
    next = { title: "Take the free 15-minute diagnostic", href: "/preparation/diagnostic", reason: "One business problem shows your strengths and gaps, so every recommendation after it is about you. It stays private.", minutes: "15 min" };
  } else if (openAssessments[0]) {
    next = { title: openAssessments[0].title, href: `/preparation/assessments/${openAssessments[0].id}`, reason: "Your placement cell opened this common assessment for everyone. It is the result they review and can share with companies, with your permission.", minutes: "30 min" };
  } else {
    const firstUndone = plan.find((item) => !tasks?.some((t) => t.task_key === item.key)) ?? plan[0];
    next = firstUndone;
  }

  return {
    profile: p, diagnostic: d, tasks: tasks ?? [], plan, next,
    pendingAssignments, assessments, domain,
  };
}
