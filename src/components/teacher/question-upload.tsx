"use client";

import * as React from "react";
import { AlertTriangle, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ParsedQuestion {
  title: string | null;
  scenario: string;
  instructions: string | null;
  expectedFramework: string | null;
  modelAnswer: string | null;
  warnings: string[];
  source?: { name: string; bytes: number };
}

const ACCEPT = ".md,.markdown,.txt,.docx";
const MAX_MB = 2;

/**
 * Upload a document to pre-fill the question editor (spec §14).
 *
 * Extraction produces a draft, never a published question — the teacher still
 * reviews every field and defines the rubric before anything reaches students.
 * The file is parsed server-side and discarded; nothing is stored.
 */
export function QuestionUpload({
  onParsed,
}: {
  onParsed: (parsed: ParsedQuestion) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [result, setResult] = React.useState<ParsedQuestion | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    // Checked here for a fast, clear message; the server checks again, because
    // a limit enforced only in the browser is not a limit.
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Files must be under ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/teacher/questions/parse", {
        method: "POST",
        body: form,
      });
      const body = await response.json();

      if (!response.ok) {
        toast.error(body.error ?? "That file could not be read.");
        return;
      }

      setResult(body as ParsedQuestion);
      onParsed(body as ParsedQuestion);
      toast.success("Extracted — check every field before publishing.");
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">
                Filled from {result.source?.name ?? "your file"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Nothing is published yet. Review the fields below, add a rubric,
                then publish.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setResult(null)}
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </Button>
          </div>

          {result.warnings.length > 0 ? (
            <ul className="space-y-1.5">
              {result.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  <span className="text-muted-foreground">{w}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      className={cn(
        "border-dashed transition-colors",
        dragging && "border-primary bg-primary/5",
      )}
    >
      <CardContent className="p-6 text-center">
        <FileUp className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">
          Start from a document
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drop a Word, Markdown or text file here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="underline underline-offset-4"
          >
            choose one
          </button>
          . Under {MAX_MB} MB.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Headings like <span className="font-mono">Instructions</span> or{" "}
          <span className="font-mono">Model answer</span> are split into the
          right fields. Everything else becomes the scenario.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />

        {busy ? (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            reading…
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
