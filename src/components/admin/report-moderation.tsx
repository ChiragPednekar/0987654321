"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ROUND_LABEL, type InterviewRound } from "@/lib/companies";
import { timeAgo } from "@/lib/utils";

export interface PendingReport {
  id: string;
  company: string;
  companySlug: string;
  role: string;
  round: InterviewRound;
  year: number;
  question: string;
  createdAt: string;
}

function ReportCard({ report, onDone }: { report: PendingReport; onDone: (id: string) => void }) {
  const [question, setQuestion] = React.useState(report.question);
  const [busy, setBusy] = React.useState<"approved" | "rejected" | null>(null);

  async function decide(status: "approved" | "rejected") {
    setBusy(status);
    try {
      const response = await fetch(`/api/admin/company-reports/${report.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "approved" && question.trim() !== report.question ? { question: question.trim() } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not update.");
        return;
      }
      toast.success(status === "approved" ? "Approved." : "Rejected.");
      onDone(report.id);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-xs text-muted-foreground">
          <Link href={`/companies/${report.companySlug}`} className="font-medium text-foreground hover:underline">
            {report.company}
          </Link>{" "}
          · {ROUND_LABEL[report.round]} · {report.role} · {report.year} · reported {timeAgo(report.createdAt)}
        </p>
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="min-h-[80px] text-sm" />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => decide("rejected")} disabled={busy !== null}>
            {busy === "rejected" ? <Loader2 className="animate-spin" /> : <X />}
            Reject
          </Button>
          <Button size="sm" onClick={() => decide("approved")} disabled={busy !== null}>
            {busy === "approved" ? <Loader2 className="animate-spin" /> : <Check />}
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportModeration({ reports: initial }: { reports: PendingReport[] }) {
  const [reports, setReports] = React.useState(initial);
  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing waiting.</p>;
  }
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} onDone={(id) => setReports((all) => all.filter((x) => x.id !== id))} />
      ))}
    </div>
  );
}
