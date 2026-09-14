"use client";

import * as React from "react";
import { Check, Copy, Loader2, ScanText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, timeAgo } from "@/lib/utils";
import {
  NUMBER_PLACEHOLDER,
  RESUME_ISSUE_LABEL,
  RESUME_LIMITS,
  RESUME_VERDICT_LABEL,
  parseBullets,
  type BulletCritique,
  type ResumeCritiqueResult,
} from "@/lib/resume";

export interface StoredCritique {
  id: string | null;
  target_role: string | null;
  bullets: string[] | null;
  result: ResumeCritiqueResult | null;
  created_at: string;
}

const VERDICT_STYLE: Record<BulletCritique["verdict"], string> = {
  strong: "border-[var(--success)]/40 text-[var(--success)]",
  needs_work: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  weak: "border-destructive/40 text-destructive",
};

/** Renders a rewrite with each [X] marked, so a gap to fill cannot be missed. */
function Rewrite({ text }: { text: string }) {
  const parts = text.split(NUMBER_PLACEHOLDER);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="rounded bg-amber-500/20 px-1 font-mono text-[0.85em] text-amber-700 dark:text-amber-300">
              {NUMBER_PLACEHOLDER}
            </mark>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy.");
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function CritiqueView({ critique }: { critique: StoredCritique }) {
  const result = critique.result;
  if (!result) return null;
  const withGaps = result.bullets.filter((b) => b.rewrite.includes(NUMBER_PLACEHOLDER)).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm">{result.summary}</p>
          {result.top_fixes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Fix these first
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
                {result.top_fixes.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ol>
            </div>
          )}
          {withGaps > 0 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
              {withGaps === 1 ? "One rewrite has" : `${withGaps} rewrites have`} a{" "}
              <span className="font-mono">{NUMBER_PLACEHOLDER}</span> where a real number
              belongs. Fill it in with what you actually achieved, or cut the phrase —
              never guess. An interviewer will ask.
            </p>
          )}
        </CardContent>
      </Card>

      {result.bullets.map((b, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={VERDICT_STYLE[b.verdict]}>
                {RESUME_VERDICT_LABEL[b.verdict]}
              </Badge>
              {b.issues.map((issue) => (
                <Badge key={issue} variant="secondary">
                  {RESUME_ISSUE_LABEL[issue]}
                </Badge>
              ))}
            </div>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                // Struck through only when there is something to replace it with.
                b.rewrite &&
                  b.rewrite.replace(/\.$/, "") !== b.original.replace(/\.$/, "") &&
                  "line-through decoration-muted-foreground/40",
              )}
            >
              {b.original}
            </p>
            <p className="text-sm">{b.feedback}</p>
            {b.rewrite ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-relaxed">
                    <Rewrite text={b.rewrite} />
                  </p>
                  <CopyButton text={b.rewrite} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No rewrite — this does not describe work you did, so there is nothing true
                to rewrite it into.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * The resume critique: paste, critique, read, copy.
 *
 * The bullet count shown under the box comes from the same parseBullets() the
 * route uses, so "8 bullets" here is exactly what gets sent and charged.
 */
export function ResumeCritic({
  history: initialHistory,
  entitled,
  gradingsLeft,
}: {
  history: StoredCritique[];
  entitled: boolean;
  gradingsLeft: number;
}) {
  const [text, setText] = React.useState("");
  const [role, setRole] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [history, setHistory] = React.useState(initialHistory);
  const [shown, setShown] = React.useState<StoredCritique | null>(null);
  const [left, setLeft] = React.useState(gradingsLeft);

  const bullets = parseBullets(text);
  const tooMany = bullets.length > RESUME_LIMITS.maxBullets;
  const tooLong = bullets.findIndex((b) => b.length > RESUME_LIMITS.maxBulletChars);

  async function critique() {
    setBusy(true);
    try {
      const response = await fetch("/api/resume/critiques", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, target_role: role || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not critique.");
        return;
      }
      const critique = payload.critique as StoredCritique;
      setShown(critique);
      if (payload.cached) {
        toast.info("You already critiqued exactly these bullets — here is that critique, at no cost.");
      } else {
        setLeft((n) => Math.max(0, n - 1));
        if (critique.id) setHistory((h) => [critique, ...h].slice(0, 10));
      }
      requestAnimationFrame(() =>
        document.getElementById("critique-result")?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function erase(id: string) {
    if (!window.confirm("Delete this critique and the bullets in it? This cannot be undone.")) return;
    const response = await fetch(`/api/resume/critiques/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.error ?? "Could not delete.");
      return;
    }
    setHistory((h) => h.filter((c) => c.id !== id));
    if (shown?.id === id) setShown(null);
    toast.success("Deleted.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Role you are applying for</span>
            <Input
              value={role}
              maxLength={RESUME_LIMITS.maxRoleChars}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Product manager at a consumer tech company (optional)"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Bullets, one per line</span>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"• Responsible for managing social media for the college fest\n• Worked on a pricing project for a D2C brand during my internship"}
              className="min-h-[200px] resize-y text-sm leading-relaxed"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={cn(
                "text-xs",
                tooMany || tooLong !== -1 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {tooMany
                ? `${bullets.length} bullets — up to ${RESUME_LIMITS.maxBullets} at a time.`
                : tooLong !== -1
                  ? `Bullet ${tooLong + 1} is over ${RESUME_LIMITS.maxBulletChars} characters.`
                  : `${bullets.length} of ${RESUME_LIMITS.maxBullets} bullets · uses 1 graded answer (${left} left)`}
            </p>
            <Button
              onClick={critique}
              disabled={busy || !entitled || bullets.length === 0 || tooMany || tooLong !== -1 || left <= 0}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ScanText />}
              {busy ? "Reading your bullets…" : "Critique"}
            </Button>
          </div>
          {!entitled && (
            <p className="text-xs text-muted-foreground">
              Critiques are available to licensed accounts. Ask your college to activate
              CaseCode, or sign in with your college email address.
            </p>
          )}
        </CardContent>
      </Card>

      {shown && (
        <div id="critique-result" className="scroll-mt-20">
          <CritiqueView critique={shown} />
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Your critiques
          </p>
          <div className="mt-2 space-y-2">
            {history.map((c) => (
              <Card
                key={c.id}
                className={cn(shown?.id === c.id && "border-primary/40")}
              >
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setShown(c)}
                  >
                    <p className="truncate text-sm font-medium">
                      {c.bullets?.[0] ?? "Critique"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.bullets?.length ?? 0} bullets
                      {c.target_role ? ` · ${c.target_role}` : ""} · {timeAgo(c.created_at)}
                    </p>
                  </button>
                  {c.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete critique"
                      onClick={() => erase(c.id!)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Deleting removes your bullets and the critique for good. It does not give back
            the graded answer it used.
          </p>
        </div>
      )}
    </div>
  );
}
