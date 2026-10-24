"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProctor } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "@/components/case/proctor-overlay";
import { CameraPreview } from "@/components/proctor/camera-preview";
import { SupportingData } from "@/components/case/case-problem-view";
import { CASE_ANSWER_SECTIONS, MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { carryOverDraft, composeAnswer, type SectionValues } from "@/lib/answer-sections";
import { SectionedAnswer } from "@/components/case/sectioned-answer";
import { cn } from "@/lib/utils";

export interface ExamCase {
  id: string;
  title: string;
  scenario: string;
  instructions: string | null;
  supporting_data: unknown;
}

/**
 * The exam room for a certificate attempt.
 *
 * Exam conditions are the same as every proctored surface — fullscreen,
 * camera, no paste, and leaving the window ends the sitting — because a
 * certificate is only worth what its supervision is worth. The cases are not
 * shown until the sitting starts, and the clock is the server's: this page
 * only counts down to the deadline /start stamped.
 *
 * Drafts are kept in this browser so a crash does not lose an answer; nothing
 * leaves the page until submit.
 */
export function ExamRoom({
  attemptId,
  title,
  durationMinutes,
  passPct,
  cases,
  caseCount,
  initialDeadline,
  retryGrading,
}: {
  attemptId: string;
  title: string;
  durationMinutes: number;
  passPct: number;
  /** Empty until the clock is running; the page reloads them after /start. */
  cases: ExamCase[];
  caseCount: number;
  initialDeadline: string | null;
  /** Submitted already, but grading did not finish: offer the retry. */
  retryGrading: boolean;
}) {
  const router = useRouter();
  const proctor = useProctor(true);
  const storageKey = `cert-attempt:${attemptId}`;

  const [deadline, setDeadline] = React.useState<string | null>(initialDeadline);
  const [active, setActive] = React.useState(0);
  // Drafts kept in this browser, restored on first render. The editor only
  // renders after the student enters exam mode, so there is no server markup
  // for this to disagree with.
  // Each case is answered in the seven steps of a case answer, kept per case.
  // A draft saved before the boxes existed was one text per case: it opens in
  // the Analysis box rather than being lost.
  const [sectionsByCase, setSectionsByCase] = React.useState<Record<string, SectionValues>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`cert-attempt:${attemptId}`) ?? "{}") as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(saved).map(([caseId, value]) => [
          caseId,
          typeof value === "string"
            ? carryOverDraft(CASE_ANSWER_SECTIONS, { analysis: value })
            : carryOverDraft(CASE_ANSWER_SECTIONS, (value ?? {}) as Record<string, string>),
        ]),
      );
    } catch {
      return {};
    }
  });
  // What is submitted and graded: each case's boxes as one answer, as before.
  const answers = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(sectionsByCase).map(([caseId, values]) => [caseId, composeAnswer(CASE_ANSWER_SECTIONS, values)]),
      ),
    [sectionsByCase],
  );
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const submitted = React.useRef(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sectionsByCase));
    } catch {
      /* storage unavailable: drafts live in memory only */
    }
  }, [sectionsByCase, storageKey]);

  // Start the server clock the first time exam mode is entered.
  React.useEffect(() => {
    if (!proctor.examMode || deadline) return;
    let cancelled = false;
    fetch(`/api/certificates/attempts/${attemptId}/start`, { method: "POST" })
      .then((r) => r.json().then((p) => ({ ok: r.ok, p })))
      .then(({ ok, p }) => {
        if (cancelled) return;
        if (!ok) {
          toast.error(p.error ?? "Could not start the exam.");
          return;
        }
        setDeadline(p.deadline_at);
        // The server sends the cases only once the clock runs. A soft refresh
        // keeps this component, its state and fullscreen.
        router.refresh();
      })
      .catch(() => toast.error("Network error starting the exam."));
    return () => {
      cancelled = true;
    };
  }, [proctor.examMode, deadline, attemptId, router]);

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = deadline ? new Date(deadline).getTime() - now : null;

  const submit = React.useCallback(
    async (auto = false) => {
      if (submitted.current && !retryGrading) return;
      submitted.current = true;
      setBusy(true);
      try {
        const response = await fetch(`/api/certificates/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers, signals: proctor.signals }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(payload.error ?? "Could not submit.");
          // A grading failure keeps the answers; allow the retry press.
          if (payload.code === "grading_retry") submitted.current = false;
          router.refresh();
          return;
        }
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* nothing to clear */
        }
        toast.success(auto ? "Time's up — your exam was submitted and marked." : "Submitted and marked.");
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        router.refresh();
      } catch {
        submitted.current = false;
        toast.error("Network error — press submit again. Your answers are saved here.");
      } finally {
        setBusy(false);
      }
    },
    [answers, attemptId, proctor.signals, retryGrading, router, storageKey],
  );

  // Auto-submit at zero.
  React.useEffect(() => {
    if (msLeft !== null && msLeft <= 0 && !submitted.current) void submit(true);
  }, [msLeft, submit]);

  if (retryGrading) {
    return (
      <div className="rounded-xl bg-card px-4 py-3 shadow-xs dark:shadow-none">
        <p className="text-sm">Your answers were submitted but have not been marked yet.</p>
        <Button variant="ink" className="mt-4" onClick={() => submit()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Mark my answers
        </Button>
      </div>
    );
  }

  if (!proctor.examMode) {
    return (
      <ProctorGate
        camera={proctor.camera}
        starting={proctor.starting}
        onStart={proctor.start}
        title={deadline ? "Return to your exam" : `Start the exam — ${durationMinutes} minutes`}
        rules={[
          `${caseCount} cases, ${durationMinutes} minutes. The clock starts when you press start and does not stop.`,
          `You pass with ${passPct}% overall. One attempt — leaving the exam ends it.`,
          "The page goes fullscreen and your camera stays on throughout.",
          "Pasting is disabled. Switching tabs or leaving this window ends the exam.",
        ]}
      />
    );
  }

  const current = cases[active];
  const minutes = msLeft !== null ? Math.max(0, Math.floor(msLeft / 60_000)) : null;
  const seconds = msLeft !== null ? Math.max(0, Math.floor((msLeft % 60_000) / 1000)) : null;

  return (
    <div className="space-y-5">
      <CameraPreview camera={proctor.camera} />
      {proctor.needsAcknowledgement && (
        <ProctorOverlay count={proctor.signals.blurCount} onResume={proctor.acknowledge} />
      )}

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background py-3">
        <p className="font-editorial text-xl">{title}</p>
        <p
          className={cn(
            "font-mono text-lg tabular",
            msLeft !== null && msLeft < 5 * 60_000 && "text-destructive",
          )}
        >
          {minutes === null ? "Starting…" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {cases.map((c, i) => {
          const len = (answers[c.id] ?? "").trim().length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "border px-3 py-1.5 text-sm",
                i === active ? "border-action bg-action text-action-foreground" : "border-border hover:border-brand-border",
              )}
            >
              Case {i + 1}
              <span className="ml-2 font-mono text-xs opacity-70">{len >= MIN_ANSWER_CHARS ? "answered" : "—"}</span>
            </button>
          );
        })}
      </div>

      {!current && <p className="text-sm text-muted-foreground">Loading the cases…</p>}

      {current && (
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="space-y-4 text-sm leading-relaxed">
            <h2 className="font-editorial text-2xl font-normal">{current.title}</h2>
            <p className="whitespace-pre-line">{current.scenario}</p>
            {current.instructions && (
              <div className="rounded-xl bg-card px-4 py-3 shadow-xs dark:shadow-none">
                <p className="font-medium">Your task</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{current.instructions}</p>
              </div>
            )}
            {current.supporting_data && typeof current.supporting_data === "object" ? (
              <SupportingData data={current.supporting_data as Record<string, unknown>} />
            ) : null}
          </article>

          <div className="space-y-2">
            <SectionedAnswer
              idPrefix={`exam-${current.id}`}
              defs={CASE_ANSWER_SECTIONS}
              values={sectionsByCase[current.id] ?? {}}
              onChange={(key, value) =>
                setSectionsByCase((all) => ({ ...all, [current.id]: { ...all[current.id], [key]: value } }))
              }
              onKeyDown={proctor.handlers.onKeyDown}
              onPaste={proctor.handlers.onPaste}
            />
            <p className={cn("text-xs tabular", (answers[current.id] ?? "").length > MAX_ANSWER_CHARS ? "text-destructive" : "text-muted-foreground")}>
              {(answers[current.id] ?? "").length.toLocaleString()}/{MAX_ANSWER_CHARS.toLocaleString()}
              {(answers[current.id] ?? "").trim().length < MIN_ANSWER_CHARS && ` · at least ${MIN_ANSWER_CHARS} characters to be marked`}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Submit when every case is done. You cannot change answers after submitting.
        </p>
        <Button
          variant="ink"
          onClick={() => {
            if (window.confirm("Submit the exam now? You cannot change your answers afterwards.")) void submit();
          }}
          disabled={busy || !deadline}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          {busy ? "Marking…" : "Submit exam"}
        </Button>
      </div>
    </div>
  );
}
