"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import type { InstitutionRosterRow } from "@/lib/types/database";

type SortKey = "name" | "solved" | "avg" | "interviews" | "active";

/**
 * The placement cell's roster.
 *
 * Client-side sorting because a cohort is at most a few thousand rows and the
 * whole point is letting staff re-rank it live — "who is furthest behind"
 * is a different sort from "who should we put forward".
 */
export function RosterTable({
  students,
  staleDays,
  /**
   * When set, each row gets a Remove action scoped to this batch. Omitted by
   * the placement dashboard, which reads a cohort it does not administer —
   * the same table, minus a power it should not have.
   */
  removeFromClassroomId,
}: {
  students: InstitutionRosterRow[];
  staleDays: number;
  removeFromClassroomId?: string;
}) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<string | null>(null);

  async function remove(student: InstitutionRosterRow) {
    if (
      !confirm(
        `Remove ${student.full_name ?? student.email} from this batch?\n\n` +
          "Their solved cases, scores and any marks you have already given are kept — only the enrolment goes.",
      )
    ) {
      return;
    }

    setRemoving(student.user_id);
    try {
      const response = await fetch(
        `/api/classrooms/${removeFromClassroomId}/members`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user_id: student.user_id }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not remove them.");
        return;
      }
      toast.success("Removed from the batch.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setRemoving(null);
    }
  }

  const [sort, setSort] = React.useState<SortKey>("solved");
  const [asc, setAsc] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const cutoff = Date.now() - staleDays * 86_400_000;

  const rows = React.useMemo(() => {
    const filtered = query.trim()
      ? students.filter((s) =>
          `${s.full_name ?? ""} ${s.email}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
      : students;

    const value = (s: InstitutionRosterRow) => {
      switch (sort) {
        case "name": return (s.full_name ?? s.email).toLowerCase();
        case "solved": return s.cases_solved;
        case "avg": return s.avg_percentage === null ? -1 : Number(s.avg_percentage);
        case "interviews": return Number(s.interviews);
        // Never-active sorts last regardless of direction: those students are
        // the ones staff are looking for, not noise at the bottom.
        case "active": return s.last_active ? new Date(s.last_active).getTime() : 0;
      }
    };

    return [...filtered].sort((a, b) => {
      const av = value(a), bv = value(b);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (asc ? 1 : -1);
    });
  }, [students, sort, asc, query]);

  function header(key: SortKey, label: string, align = "left") {
    return (
      <th className={cn("py-2 font-medium", align === "right" && "text-right")}>
        <button
          type="button"
          onClick={() => {
            if (sort === key) setAsc((v) => !v);
            else { setSort(key); setAsc(false); }
          }}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground",
            sort === key && "text-foreground",
          )}
        >
          {label}
          <ArrowUpDown className="size-3" />
        </button>
      </th>
    );
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No students enrolled yet. Students join automatically when they sign up
        with an email address on your licensed domain.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        aria-label="Search students"
        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              {header("name", "Student")}
              {header("solved", "Solved", "right")}
              {header("avg", "Avg score", "right")}
              {header("interviews", "Interviews", "right")}
              {header("active", "Last active", "right")}
              {removeFromClassroomId ? (
                <th className="py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const lapsed =
                !s.last_active || new Date(s.last_active).getTime() < cutoff;
              return (
                <tr
                  key={s.user_id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2">
                    <Link
                      href={`/u/${s.user_id}`}
                      className="font-medium hover:underline"
                    >
                      {s.full_name ?? "Unnamed"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </td>
                  <td className="py-2 text-right tabular">{s.cases_solved}</td>
                  <td className="py-2 text-right tabular">
                    {s.avg_percentage !== null
                      ? `${Number(s.avg_percentage).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-2 text-right tabular">
                    {formatNumber(Number(s.interviews))}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right text-xs",
                      lapsed ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {s.last_active ? timeAgo(s.last_active) : "never started"}
                  </td>
                  {removeFromClassroomId ? (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(s)}
                        disabled={removing === s.user_id}
                        aria-label={`Remove ${s.full_name ?? s.email} from this batch`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {removing === s.user_id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <UserMinus className="size-3" />
                        )}
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Amber marks no graded submission in the last {staleDays} days.
      </p>
    </div>
  );
}
