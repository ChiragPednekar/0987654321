"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { latestReviews, STALE_DAYS } from "@/lib/placement/core";
import type { CollegeData } from "@/lib/placement/server";
import { timeAgo } from "@/lib/utils";
import { fieldClass } from "./forms";

type Activity = Record<string, { solved: number; lastActive: string | null }>;

const SUPPORT = [
  ["", "All students"],
  ["not_started", "Not started any practice"],
  ["inactive", `No practice in ${STALE_DAYS} days`],
  ["no_assessment", "No common assessment yet"],
  ["review", "Awaiting faculty review"],
  ["low", "Reviewed result below 60%"],
] as const;

/**
 * Every enrolled student, including the ones who have never opened the site —
 * a directory of only the active would make a keen minority look like the
 * whole college. Comparison is one common assessment at a time: different
 * tasks are never blended into a single rank.
 */
export function StudentDirectory({
  data,
  institutionId,
  activity,
  now,
}: {
  data: CollegeData;
  institutionId: string;
  activity: Activity;
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [programme, setProgramme] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [year, setYear] = useState("");
  const [batch, setBatch] = useState("");
  const [assessment, setAssessment] = useState("");
  const [support, setSupport] = useState("");

  const reviews = useMemo(() => latestReviews(data.reviews), [data.reviews]);
  const unique = (key: "target_role" | "programme" | "specialisation") =>
    [...new Set(data.profiles.map((p) => p[key]).filter(Boolean))].sort();
  const batchNames = new Map(
    data.batches.map((b) => [b.classroom_id, (Array.isArray(b.classrooms) ? b.classrooms[0] : b.classrooms)?.name ?? "Batch"]),
  );
  const stale = now - STALE_DAYS * 86_400_000;

  const rows = data.users
    .map((u) => {
      const profile = data.profiles.find((p) => p.user_id === u.id);
      const attempts = data.attempts.filter((a) => a.user_id === u.id && a.status === "evaluated");
      const chosen = attempts.find((a) => a.assessment_id === assessment);
      const review = chosen ? reviews.get(chosen.id) : undefined;
      const pending = attempts.filter((a) => !reviews.has(a.id)).length;
      const practice = activity[u.id] ?? { solved: 0, lastActive: null };
      // Teacher reviews from group discussions: the mean of the four 0–5 marks.
      const gd = data.gdReviews.filter((r) => r.user_id === u.id);
      const gdMarks = gd.flatMap((r) => Object.values(r.scores).map(Number)).filter(Number.isFinite);
      const gdAvg = gdMarks.length ? gdMarks.reduce((a, b) => a + b, 0) / gdMarks.length : null;
      return { ...u, profile, attempts, chosen, review, pending, practice, gdCount: gd.length, gdAvg };
    })
    .filter((u) => {
      if (query && !`${u.full_name} ${u.email}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (role && u.profile?.target_role !== role) return false;
      if (programme && u.profile?.programme !== programme) return false;
      if (specialisation && u.profile?.specialisation !== specialisation) return false;
      if (year && String(u.profile?.graduation_year) !== year) return false;
      if (batch && !data.batches.some((b) => b.user_id === u.id && b.classroom_id === batch)) return false;
      switch (support) {
        case "not_started": return !u.practice.lastActive;
        case "inactive": return !u.practice.lastActive || new Date(u.practice.lastActive).getTime() < stale;
        case "no_assessment": return u.attempts.length === 0;
        case "review": return u.pending > 0;
        case "low": return u.attempts.some((a) => (reviews.get(a.id)?.percentage ?? 100) < 60);
        default: return true;
      }
    })
    .sort((a, b) =>
      assessment
        ? (b.review?.percentage ?? -1) - (a.review?.percentage ?? -1)
        : (a.full_name ?? "").localeCompare(b.full_name ?? ""),
    );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-medium">Student directory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one common assessment to compare faculty-reviewed results. There is no combined readiness rank, and a missing result means insufficient evidence — not a poor student.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Search students" placeholder="Name or email" value={query} onChange={(e) => setQuery(e.target.value)} className={fieldClass} />
        <select aria-label="Target role" value={role} onChange={(e) => setRole(e.target.value)} className={fieldClass}>
          <option value="">All target roles</option>
          {unique("target_role").map((v) => <option key={v}>{v}</option>)}
        </select>
        <select aria-label="Programme" value={programme} onChange={(e) => setProgramme(e.target.value)} className={fieldClass}>
          <option value="">All programmes</option>
          {unique("programme").map((v) => <option key={v}>{v}</option>)}
        </select>
        <select aria-label="Specialisation" value={specialisation} onChange={(e) => setSpecialisation(e.target.value)} className={fieldClass}>
          <option value="">All specialisations</option>
          {unique("specialisation").map((v) => <option key={v}>{v}</option>)}
        </select>
        <select aria-label="Graduation year" value={year} onChange={(e) => setYear(e.target.value)} className={fieldClass}>
          <option value="">All graduating years</option>
          {[...new Set(data.profiles.map((p) => p.graduation_year).filter(Boolean))].sort().map((v) => <option key={v} value={v!}>{v}</option>)}
        </select>
        <select aria-label="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} className={fieldClass}>
          <option value="">All batches</option>
          {[...batchNames].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Common assessment" value={assessment} onChange={(e) => setAssessment(e.target.value)} className={fieldClass}>
          <option value="">Compare on an assessment…</option>
          {data.assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <select aria-label="Support queue" value={support} onChange={(e) => setSupport(e.target.value)} className={fieldClass}>
          {SUPPORT.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {["Student", "Target role / programme", "Practice", "Assessments", "GD feedback", "Selected assessment", "Sharing"].map((h) => (
                <th key={h} className="p-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">
                  <Link className="font-medium hover:underline" href={`/placement/students/${u.id}?institution=${institutionId}`}>
                    {u.full_name ?? "Student"}
                  </Link>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="p-3">
                  {u.profile?.target_role || <span className="text-muted-foreground">Not set</span>}
                  <p className="text-xs text-muted-foreground">{[u.profile?.programme, u.profile?.specialisation].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="p-3 text-xs">
                  {u.practice.lastActive ? (
                    <>{u.practice.solved} solved<p className="text-muted-foreground">{timeAgo(u.practice.lastActive)}</p></>
                  ) : (
                    <span className="text-amber-600">Not started</span>
                  )}
                </td>
                <td className="p-3 text-xs">{u.attempts.length} done · {u.pending} to review</td>
                <td className="p-3 text-xs">
                  {u.gdAvg === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>{u.gdAvg.toFixed(1)} / 5<p className="text-muted-foreground">{u.gdCount} teacher {u.gdCount === 1 ? "review" : "reviews"}</p></>
                  )}
                </td>
                <td className="p-3">
                  {assessment ? (
                    u.review ? (
                      <>
                        <strong>{u.review.percentage.toFixed(1)}%</strong>
                        <p className="text-xs text-muted-foreground">Faculty-reviewed · {new Date(u.review.created_at).toLocaleDateString()}</p>
                      </>
                    ) : u.chosen ? (
                      <span className="text-xs">AI-evaluated · awaiting review</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Insufficient evidence</span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-xs">{u.open_to_opportunities ? "Opted in" : "Private"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-5 text-sm text-muted-foreground">No students match these filters.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} of {data.users.length} enrolled students. Practice volume, points and subscription usage never affect the assessment comparison.
      </p>
    </section>
  );
}
