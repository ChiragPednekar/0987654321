"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Send, Timer } from "lucide-react";
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
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Submission failed. Try again.");
        return;
      }

      window.localStorage.removeItem(storageKey);
      toast.success("Evaluated. Scroll down for your score.");
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

  return (
    <div className="space-y-3">
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
                    {value.trim().length}/{section.minChars}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
                <Textarea
                  id={`section-${section.key}`}
                  value={value}
                  onChange={(event) =>
                    updateSection(section.key, event.target.value)
                  }
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
