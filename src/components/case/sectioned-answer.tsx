"use client";

import type * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerSectionDef, AnswerSectionKey } from "@/lib/constants";
import type { SectionValues } from "@/lib/answer-sections";
import { cn } from "@/lib/utils";

/**
 * The answer as a set of numbered boxes — the seven steps of a case answer,
 * or three parts for other formats. Used by the case page and the
 * certificate exam room, so a student meets the same structure in both.
 */
export function SectionedAnswer({
  defs,
  values,
  onChange,
  onKeyDown,
  onPaste,
  idPrefix = "section",
}: {
  defs: readonly AnswerSectionDef[];
  values: SectionValues;
  onChange: (key: AnswerSectionKey, value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  idPrefix?: string;
}) {
  return (
    <ol className="space-y-5">
      {defs.map((section, i) => {
        const value = values[section.key] ?? "";
        const length = value.trim().length;
        const short = length < section.minChars;
        const id = `${idPrefix}-${section.key}`;
        return (
          <li key={section.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={id} className="text-sm font-medium">
                <span className="mr-1.5 font-mono text-xs text-muted-foreground">{i + 1}.</span>
                {section.label}
              </label>
              <span className={cn("text-xs tabular", short ? "text-muted-foreground" : "text-[var(--success)]")}>
                {/*
                  `minChars` is a floor, but "299/60" is read by everyone as
                  299 out of a permitted 60, so say which way the number points.
                */}
                {short ? `${section.minChars - length} more characters` : `${length} characters`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{section.hint}</p>
            <Textarea
              id={id}
              value={value}
              onChange={(event) => onChange(section.key, event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={section.placeholder}
              className={cn(
                "resize-y font-mono text-[13px] leading-relaxed",
                section.minChars >= 100 ? "min-h-[150px]" : "min-h-[84px]",
              )}
              spellCheck
            />
          </li>
        );
      })}
    </ol>
  );
}
