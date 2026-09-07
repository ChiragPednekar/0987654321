"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, ExternalLink, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FacultyResource } from "@/lib/faculty-resources";

export function FacultyResourceCard({ resource }: { resource: FacultyResource }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card className="flex flex-col justify-between border-border/80 transition-all hover:border-primary/50 hover:shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="text-xs">
              {resource.category}
            </Badge>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {resource.readingTime}
            </span>
          </div>
          <CardTitle className="text-base font-semibold leading-snug pt-1 text-foreground">
            {resource.title}
          </CardTitle>
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <GraduationCap className="size-3.5 text-primary shrink-0" />
            <span className="font-medium text-foreground">{resource.instructor}</span>
            <span>• {resource.instructorRole}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {resource.summary}
          </p>

          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <span className="text-[11px] font-medium text-emerald-500">
              Free Open Resource
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              className="h-7 text-xs gap-1.5"
            >
              <BookOpen className="size-3" />
              Read Guide
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reader Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border/70 p-5 bg-muted/20">
              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {resource.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {resource.readingTime}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {resource.title}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="size-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">
                    {resource.instructor}
                  </span>
                  <span>({resource.instructorRole})</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="overflow-y-auto p-6 space-y-6 text-sm">
              {/* Key Takeaways */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Key Takeaways
                </h3>
                <ul className="space-y-1.5">
                  {resource.keyTakeaways.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                      <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Main Guide Body */}
              <div className="space-y-4 whitespace-pre-wrap font-sans leading-relaxed text-muted-foreground">
                {resource.content}
              </div>

              {/* Recommended Cases */}
              {resource.recommendedCases.length > 0 ? (
                <div className="border-t border-border pt-4 space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Apply this framework in practice cases
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {resource.recommendedCases.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/cases/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-muted"
                      >
                        <span>{c.title}</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-6 py-3">
              <span className="text-xs text-muted-foreground">
                CaseCode Open Faculty Series
              </span>
              <Button size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
