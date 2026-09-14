"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  INTERVIEW_ROUNDS,
  REPORT_LIMITS,
  ROUND_LABEL,
  reportYears,
  type InterviewRound,
} from "@/lib/companies";

interface MyReport {
  id: string;
  role: string;
  round: InterviewRound;
  year: number;
  question: string;
  status: string;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function ReportQuestion({
  slug,
  companyName,
  mine: initialMine,
}: {
  slug: string;
  companyName: string;
  mine: MyReport[];
}) {
  const years = reportYears();
  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState("");
  const [round, setRound] = React.useState<InterviewRound>("case_interview");
  const [year, setYear] = React.useState(years[0]);
  const [question, setQuestion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [mine, setMine] = React.useState(initialMine);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`/api/companies/${slug}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, round, year, question }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not send your report.");
        return;
      }
      setMine((m) => [payload.report, ...m]);
      setQuestion("");
      setOpen(false);
      toast.success("Thank you. It will appear once it has been checked.");
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {mine.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Your reports
          </p>
          {mine.map((r) => (
            <Card key={r.id} className="border-dashed">
              <CardContent className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm">{r.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ROUND_LABEL[r.round]} · {r.role} · {r.year}
                  </p>
                </div>
                <Badge variant={r.status === "rejected" ? "outline" : "secondary"}>
                  {r.status === "pending" ? "Being checked" : r.status === "rejected" ? "Not published" : r.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Report a question you were asked
        </Button>
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm font-medium">What were you asked at {companyName}?</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 sm:col-span-1">
                  <span className="text-xs text-muted-foreground">Role</span>
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    maxLength={REPORT_LIMITS.maxRole}
                    placeholder="e.g. Associate"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Round</span>
                  <select
                    className={selectClass}
                    value={round}
                    onChange={(e) => setRound(e.target.value as InterviewRound)}
                  >
                    {INTERVIEW_ROUNDS.map((r) => (
                      <option key={r} value={r}>
                        {ROUND_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Year</span>
                  <select className={selectClass} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">The question, as close to how it was asked as you remember</span>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={REPORT_LIMITS.maxQuestion}
                  className="min-h-[100px] text-sm"
                  required
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Please leave out names of interviewers or other candidates. Your name is never shown.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || question.trim().length < REPORT_LIMITS.minQuestion || role.trim().length < 2}>
                  {busy ? <Loader2 className="animate-spin" /> : <Send />}
                  Send for checking
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
