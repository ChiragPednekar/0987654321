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
  MAX_ANSWER_CHARS,
  MIN_ANSWER_CHARS,
  type AnswerSectionKey,
  type AnswerSectionDef,
} from "@/lib/constants";
import {
  carryOverDraft,
  composeAnswer,
  emptySections,
  filledSections,
  firstIncomplete,
  sectionsFor,
  type SectionValues,
} from "@/lib/answer-sections";
import { SectionedAnswer } from "./sectioned-answer";
import { cn, formatDuration } from "@/lib/utils";
import type { AnswerSections } from "@/lib/types/database";
import { useProctor } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "./proctor-overlay";
import { CameraPreview } from "@/components/proctor/camera-preview";
import { readStoredOnce } from "@/hooks/use-browser-state";
import { useCaseProctor } from "./case-proctor-shell";

interface AnswerEditorProps {
  caseId: string;
  caseSlug: string;
  contestId?: string;
  signedIn: boolean;
  /** Restores an in-progress draft between reloads. */
  storageKey: string;
  /** The case's format: a full case is answered in the seven steps. */
  format?: string | null;
}

type Mode = "structured" | "free";

/**
 * The draft this browser saved for the case, or an empty one. Null-safe on the
 * server, where the editor is not shown and storage does not exist: the
 * textareas only render after Start, so the server and the first client render
 * still agree. A draft from the earlier three-box layout carries over.
 */
function loadDraft(key: string, defs: readonly AnswerSectionDef[]): { mode: Mode; sections: SectionValues; freeText: string } {
  const empty = { mode: "structured" as Mode, sections: emptySections(defs), freeText: "" };
  const saved = readStoredOnce(key);
  if (!saved) return empty;
  try {
    const parsed = JSON.parse(saved) as {
      mode?: Mode;
      sections?: Record<string, string>;
      freeText?: string;
    } | null;
    return {
      mode: parsed?.mode ?? empty.mode,
      sections: carryOverDraft(defs, parsed?.sections ?? {}),
      freeText: parsed?.freeText ?? "",
    };
  } catch {
    // Drafts saved by the older single-textarea editor were plain strings.
    return { mode: "free", sections: empty.sections, freeText: saved };
  }
}

export function AnswerEditor({
  caseId,
  caseSlug,
  contestId,
  signedIn,
  storageKey,
  format,
}: AnswerEditorProps) {
  const defs = sectionsFor(format);
  const router = useRouter();
  const sharedProctor = useCaseProctor();
  // The saved draft seeds the editor once, as it first renders. The page keys
  // this component by the draft, so another case is a fresh mount with its own
  // draft rather than this one's state carried across.
  const [draft] = React.useState(() => loadDraft(storageKey, defs));
  const [mode, setMode] = React.useState<Mode>(draft.mode);
  const [sections, setSections] = React.useState<SectionValues>(draft.sections);
  const [freeText, setFreeText] = React.useState(draft.freeText);
  const [submitting, setSubmitting] = React.useState(false);
  const [localElapsed, setLocalElapsed] = React.useState(0);
  // Read once, at mount, never again: a lazy initialiser, so re-renders cannot
  // move the start of the clock.
  const [localStartedAt] = React.useState(() => Date.now());

  const fallbackProctor = useProctor(signedIn && !sharedProctor);
  const proctor = sharedProctor ? sharedProctor.proctor : fallbackProctor;
  const startedAt = sharedProctor ? sharedProctor.startedAt : localStartedAt;
  const elapsed = sharedProctor ? sharedProctor.elapsed : localElapsed;

  /**
   * Stamp the start server-side (when not already handled by CaseProctorShell).
   */
  React.useEffect(() => {
    if (!signedIn || sharedProctor) return;
    void fetch("/api/attempts/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ case_id: caseId }),
    }).catch(() => {
      // Best effort. A missing stamp means the speed check is skipped for this
      // attempt, which is the lenient outcome and the right one.
    });
  }, [signedIn, sharedProctor, caseId]);

  const answer = mode === "structured" ? composeAnswer(defs, sections) : freeText;

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
    if (sharedProctor) return;
    const timer = setInterval(
      () => setLocalElapsed(Math.floor((Date.now() - localStartedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [sharedProctor, localStartedAt]);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;
  const tooLong = answer.length > MAX_ANSWER_CHARS;

  // In structured mode, name the section that still needs work rather than
  // just refusing to submit.
  const incompleteSection = mode === "structured" ? firstIncomplete(defs, sections) : undefined;

  function updateSection(key: AnswerSectionKey, value: string) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (tooShort || tooLong) return;
    setSubmitting(true);

    // Only send sections when they were actually used; free text stores {}.
    const answer_sections: AnswerSections = mode === "structured" ? filledSections(defs, sections) : {};

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          contest_id: contestId,
          answer,
          answer_sections,
          time_spent_seconds: Math.floor((Date.now() - startedAt) / 1000),
          signals: proctor.signals,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Submission failed. Try again.");
        return;
      }

      window.localStorage.removeItem(storageKey);
      setSections(emptySections(defs));
      setFreeText("");
      // Release the beforeunload guard and fullscreen before navigating, or the
      // router push below trips the very dialog meant to deter abandoning an
      // attempt.
      if (sharedProctor) sharedProctor.finishAttempt();
      else proctor.stop();

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
    return <ProctorGate camera={proctor.camera} starting={proctor.starting} onStart={proctor.start} />;
  }

  return (
    <div className="space-y-3">
      {/*
        Only while exam mode is on. Blanking the page every time a practising
        student alt-tabs to their calculator would teach them to resent the
        feature rather than to stay put.
      */}
      {!sharedProctor && proctor.examMode && <CameraPreview camera={proctor.camera} />}
      {!sharedProctor && proctor.examMode && proctor.needsAcknowledgement && (
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
          Exam conditions. Pasting is disabled — type your answer here.
          Switching tabs or leaving this window ends the test.
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
        <SectionedAnswer
          defs={defs}
          values={sections}
          onChange={updateSection}
          onKeyDown={proctor.handlers.onKeyDown}
          onPaste={proctor.handlers.onPaste}
        />
      ) : (
        <Textarea
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          placeholder={
            "Structure your answer. A strong response has:\n\n" +
            defs.map((d, i) => `${i + 1}. ${d.label}`).join("\n") +
            "\n\nMarkdown works here."
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
