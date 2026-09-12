"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  ANSWER_SECTIONS,
  MAX_ANSWER_CHARS,
  MIN_ANSWER_CHARS,
  type AnswerSectionKey,
} from "@/lib/constants";
import { cn, formatDuration } from "@/lib/utils";
import type { AnswerSections } from "@/lib/types/database";
import { useProctor } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "./proctor-overlay";

interface AnswerEditorProps {
  caseId: string;
  caseSlug: string;
  contestId?: string;
  signedIn: boolean;
  /** Restores an in-progress draft between reloads. */
  storageKey: string;
}

type Mode = "structured" | "free";

type SectionState = Record<AnswerSectionKey, string>;

const EMPTY_SECTIONS = Object.fromEntries(
  ANSWER_SECTIONS.map((s) => [s.key, ""]),
) as SectionState;

/**
 * Renders the sections into the single markdown answer the grader reads, so
 * the whole evaluation path stays identical whichever mode was used.
 */
function composeAnswer(sections: SectionState): string {
  return ANSWER_SECTIONS.map(({ key, label }) => {
    const body = sections[key].trim();
    return body ? `## ${label}\n\n${body}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
}

export function AnswerEditor({
  caseId,
  caseSlug,
  contestId,
  signedIn,
  storageKey,
}: AnswerEditorProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("structured");
  const [sections, setSections] = React.useState<SectionState>(EMPTY_SECTIONS);
  const [freeText, setFreeText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const startedAt = React.useRef<number>(Date.now());

  const proctor = useProctor(signedIn);

  /**
   * Stamp the start server-side.
   *
   * The on-screen timer runs off `startedAt` and always will, but that number
   * lives in the student's browser. This tells the server when the case was
   * opened so the integrity check has a clock nobody can wind back. Fired once
   * per mount; the route keeps the earliest stamp, so a reload never shortens
   * the recorded attempt.
   */
  React.useEffect(() => {
    if (!signedIn) return;
    void fetch("/api/attempts/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ case_id: caseId }),
    }).catch(() => {
      // Best effort. A missing stamp means the speed check is skipped for this
      // attempt, which is the lenient outcome and the right one.
    });
  }, [signedIn, caseId]);


  // Restore any local draft on mount.
  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        mode?: Mode;
        sections?: SectionState;
        freeText?: string;
      };
      if (parsed.mode) setMode(parsed.mode);
      if (parsed.sections) setSections({ ...EMPTY_SECTIONS, ...parsed.sections });
      if (parsed.freeText) setFreeText(parsed.freeText);
    } catch {
      // Drafts saved by the older single-textarea editor were plain strings.
      setMode("free");
      setFreeText(saved);
    }
  }, [storageKey]);

  const answer = mode === "structured" ? composeAnswer(sections) : freeText;

  // Persist the draft — losing 45 minutes of writing to a stray refresh is
  // the fastest way to lose a user.
  React.useEffect(() => {
    if (!answer) return;
    const timer = setTimeout(
      () =>
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ mode, sections, freeText }),
        ),
      500,
    );
    return () => clearTimeout(timer);
  }, [answer, mode, sections, freeText, storageKey]);

  React.useEffect(() => {
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;
  const tooLong = answer.length > MAX_ANSWER_CHARS;

  // In structured mode, name the section that still needs work rather than
  // just refusing to submit.
  const incompleteSection =
    mode === "structured"
      ? ANSWER_SECTIONS.find((s) => sections[s.key].trim().length < s.minChars)
      : undefined;

  function updateSection(key: AnswerSectionKey, value: string) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (tooShort || tooLong) return;
    setSubmitting(true);

    // Only send sections when they were actually used; free text stores {}.
    const answer_sections: AnswerSections =
      mode === "structured"
        ? Object.fromEntries(
            ANSWER_SECTIONS.map(({ key }) => [key, sections[key].trim()]).filter(
              ([, v]) => v,
            ),
          )
        : {};

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          contest_id: contestId,
          answer,
          answer_sections,
          time_spent_seconds: Math.floor((Date.now() - startedAt.current) / 1000),
          signals: proctor.signals,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Submission failed. Try again.");
        return;
      }

      window.localStorage.removeItem(storageKey);
      // Release the beforeunload guard and fullscreen before navigating, or the
      // router push below trips the very dialog meant to deter abandoning an
      // attempt.
      proctor.stop();

      if (payload.integrity?.blocked) {
        toast.error(payload.integrity.warning, { duration: 30_000 });
      } else if (payload.integrity?.warning) {
        toast.warning(payload.integrity.warning, { duration: 15_000 });
      } else {
        toast.success("Evaluated. Scroll down for your score.");
      }
      router.push(`/cases/${caseSlug}?submission=${payload.submission_id}#review`);
      router.refresh();
    } catch {
      toast.error("Network error. Your draft is saved locally.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Log in to submit an answer and get it graded.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/login?next=/cases/${caseSlug}`}>Log in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Nothing to write in until the attempt has been started.
   *
   * The editor is withheld rather than merely disabled so there is no path
   * where text can be entered outside supervision — and because the gate is
   * what produces the user gesture fullscreen requires.
   */
  if (!proctor.examMode) {
    return <ProctorGate starting={proctor.starting} onStart={proctor.start} />;
  }

  return (
    <div className="space-y-3">
      {/*
        Only while exam mode is on. Blanking the page every time a practising
        student alt-tabs to their calculator would teach them to resent the
        feature rather than to stay put.
      */}
      {proctor.examMode && proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}

      {/*
        Kept visible for the whole attempt rather than shown once on the gate.
        A student who is about to be marked down for how their answer arrived
        should be able to see the rule at the moment they are breaking it, not
        only in a card they clicked past forty minutes ago.
      */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          Exam conditions. Pasting is disabled — type your answer here. Time
          away from this page is recorded and can reduce your mark.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["structured", "Structured"],
              ["free", "Free text"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                mode === value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {/*
            A statement, not a switch. Exam mode cannot be declined, so offering
            a control that turns it off would be a lie about what the button
            does. `fullscreen` is reported separately because it genuinely may
            not be available — iOS Safari has no fullscreen API — while every
            other control still applies.
          */}
          <span className="flex items-center gap-1.5 text-[var(--warning,#d97706)]">
            <Lock className="size-3.5" />
            {proctor.fullscreen ? "Exam mode" : "Exam mode (no fullscreen)"}
          </span>
          <span className="flex items-center gap-1.5">
            <Timer className="size-3.5" />
            <span className="tabular">{formatDuration(elapsed)}</span>
          </span>
          <span className="tabular">
            {wordCount} words ·{" "}
            <span className={cn(tooLong && "text-destructive")}>
              {answer.length.toLocaleString()}/
              {MAX_ANSWER_CHARS.toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      {mode === "structured" ? (
        <div className="space-y-4">
          {ANSWER_SECTIONS.map((section) => {
            const value = sections[section.key];
            const short = value.trim().length < section.minChars;
            return (
              <div key={section.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor={`section-${section.key}`}
                    className="text-sm font-medium"
                  >
                    {section.label}
                  </label>
                  <span
                    className={cn(
                      "text-xs tabular",
                      short ? "text-muted-foreground" : "text-[var(--success)]",
                    )}
                  >
                    {/*
                      `minChars` is a floor, but "299/60" is read by everyone as
                      299 out of a permitted 60 — the universal meaning of that
                      format — so a student who had written a good answer saw
                      what looked like a five-times overrun and started cutting.
                      Say which direction the number points instead.
                    */}
                    {short
                      ? `${section.minChars - value.trim().length} more characters`
                      : `${value.trim().length} characters`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
                <Textarea
                  id={`section-${section.key}`}
                  value={value}
                  onChange={(event) =>
                    updateSection(section.key, event.target.value)
                  }
                  onKeyDown={proctor.handlers.onKeyDown}
                  onPaste={proctor.handlers.onPaste}
                  placeholder={section.placeholder}
                  className="min-h-[150px] resize-y font-mono text-[13px] leading-relaxed"
                  spellCheck
                />
              </div>
            );
          })}
        </div>
      ) : (
        <Textarea
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          placeholder={
            "Structure your answer. A strong response usually has:\n\n" +
            "1. How you're breaking the problem down\n" +
            "2. The analysis, with the numbers actually computed\n" +
            "3. Risks and what would change your mind\n" +
            "4. A clear recommendation you commit to\n\n" +
            "Markdown works here."
          }
          onKeyDown={proctor.handlers.onKeyDown}
          onPaste={proctor.handlers.onPaste}
          className="min-h-[420px] resize-y font-mono text-[13px] leading-relaxed"
          spellCheck
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {incompleteSection
            ? `${incompleteSection.label} needs a bit more detail.`
            : tooShort
              ? `At least ${MIN_ANSWER_CHARS} characters (${answer.trim().length} so far).`
              : "Draft saved locally as you type."}
        </p>
        <Button onClick={submit} disabled={submitting || tooShort || tooLong}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          {submitting ? "Evaluating…" : "Submit for evaluation"}
        </Button>
      </div>
    </div>
  );
}
