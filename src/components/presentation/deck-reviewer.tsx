"use client";

import * as React from "react";
import { FileUp, Loader2, Presentation, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, timeAgo } from "@/lib/utils";
import { NUMBER_PLACEHOLDER } from "@/lib/resume";
import {
  DECK_CRITERIA,
  DECK_LIMITS,
  SLIDE_ISSUE_LABEL,
  type DeckCriterion,
  type DeckCritiqueResult,
} from "@/lib/deck";

export interface StoredDeckReview {
  id: string | null;
  file_name: string | null;
  context: string | null;
  result: DeckCritiqueResult | null;
  created_at: string;
}

const MB = Math.round(DECK_LIMITS.maxBytes / 1024 / 1024);

function Title({ text }: { text: string }) {
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

function ReviewView({ review }: { review: StoredDeckReview }) {
  const result = review.result;
  if (!result) return null;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(DECK_CRITERIA) as DeckCriterion[]).map((key) => (
              <div key={key} className="rounded-md border p-2.5 text-center">
                <p className="text-xl font-semibold tabular">
                  {result.scores[key]}
                  <span className="text-xs text-muted-foreground">/10</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{DECK_CRITERIA[key]}</p>
              </div>
            ))}
          </div>
          <p className="text-sm">{result.summary}</p>
          {result.top_fixes.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fix these first</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
                {result.top_fixes.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {result.slides.map((s) => {
        const changed = s.suggested_title && s.suggested_title !== s.title_as_written;
        return (
          <Card key={s.slide}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Slide {s.slide}</Badge>
                {s.issues.map((issue) => (
                  <Badge key={issue} variant="secondary">
                    {SLIDE_ISSUE_LABEL[issue]}
                  </Badge>
                ))}
              </div>
              <p className={cn("text-sm", changed && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                {s.title_as_written || <span className="italic">No title</span>}
              </p>
              {changed && (
                <p className="rounded-md border bg-muted/30 p-2.5 text-sm font-medium">
                  <Title text={s.suggested_title} />
                </p>
              )}
              <p className="text-sm text-muted-foreground">{s.comment}</p>
            </CardContent>
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">
        A suggested title uses only figures read from that slide. Where a number would help but is
        not on the slide, it shows <span className="font-mono">{NUMBER_PLACEHOLDER}</span> — put the
        real figure in, or leave the claim out.
      </p>
    </div>
  );
}

export function DeckReviewer({
  history: initialHistory,
  entitled,
  gradingsLeft,
}: {
  history: StoredDeckReview[];
  entitled: boolean;
  gradingsLeft: number;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [context, setContext] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [shown, setShown] = React.useState<StoredDeckReview | null>(null);
  const [history, setHistory] = React.useState(initialHistory);
  const [left, setLeft] = React.useState(gradingsLeft);

  const tooBig = file ? file.size > DECK_LIMITS.maxBytes : false;
  const notPdf = file ? !/\.pdf$/i.test(file.name) && file.type !== "application/pdf" : false;

  async function review() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (context.trim()) form.set("context", context.trim());
      const response = await fetch("/api/presentation/reviews", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({ error: "The upload was rejected — is it under the size limit?" }));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not review the deck.");
        return;
      }
      const r = payload.review as StoredDeckReview;
      setShown(r);
      if (payload.cached) {
        toast.info("You already had this deck reviewed — here is that review, at no cost.");
      } else {
        setLeft((n) => Math.max(0, n - 1));
        if (r.id) setHistory((h) => [r, ...h].slice(0, 10));
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function erase(id: string) {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    const response = await fetch(`/api/presentation/reviews/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Could not delete.");
      return;
    }
    setHistory((h) => h.filter((r) => r.id !== id));
    if (shown?.id === id) setShown(null);
    toast.success("Deleted.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors hover:bg-accent/40",
              (tooBig || notPdf) && "border-destructive/60",
            )}
          >
            <FileUp className="size-6 text-muted-foreground" />
            <span className="font-medium">{file ? file.name : "Choose your deck (PDF)"}</span>
            <span className="text-xs text-muted-foreground">
              {tooBig
                ? `This file is ${(file!.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MB} MB.`
                : notPdf
                  ? "Export your slides as a PDF first."
                  : `PDF, up to ${MB} MB and ${DECK_LIMITS.maxPages} slides. In PowerPoint: File → Export → PDF → "Minimum size".`}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">What is this deck for?</span>
            <Input
              value={context}
              maxLength={DECK_LIMITS.maxContextChars}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Case competition final round — market entry recommendation (optional)"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Your file is read and discarded, never stored. Uses 1 graded answer ({left} left).
            </p>
            <Button onClick={review} disabled={!file || tooBig || notPdf || busy || !entitled || left <= 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Presentation />}
              {busy ? "Reading your slides…" : "Review deck"}
            </Button>
          </div>
          {!entitled && (
            <p className="text-xs text-muted-foreground">
              Deck reviews are available to licensed accounts. Ask your college to activate CaseCode.
            </p>
          )}
        </CardContent>
      </Card>

      {shown && <ReviewView review={shown} />}

      {history.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your reviews</p>
          <div className="mt-2 space-y-2">
            {history.map((r) => (
              <Card key={r.id} className={cn(shown?.id === r.id && "border-primary/40")}>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setShown(r)}>
                    <p className="truncate text-sm font-medium">{r.file_name ?? "Deck"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.result?.slides.length ?? 0} slides{r.context ? ` · ${r.context}` : ""} · {timeAgo(r.created_at)}
                    </p>
                  </button>
                  {r.id && (
                    <Button size="sm" variant="ghost" aria-label="Delete review" onClick={() => erase(r.id!)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
