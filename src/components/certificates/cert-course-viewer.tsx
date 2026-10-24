"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { CertCourse, CourseModule } from "@/lib/cert-courses";
import { DIFFICULTY_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ModuleCheck, type CheckQuestionView } from "@/components/certificates/module-check";

interface CertCourseViewerProps {
  course: CertCourse;
  examTitle: string;
  /** Modules whose knowledge check this account has passed, from the server (075). */
  passedIds: string[];
  /** Each module's check, without answers. */
  checks: Record<string, CheckQuestionView[]>;
  signedIn: boolean;
}

/**
 * The prep course. A module is complete only when its knowledge check is
 * passed — the server records it — and the exam unlocks when all are.
 */
export function CertCourseViewer({ course, examTitle, passedIds, checks, signedIn }: CertCourseViewerProps) {
  const [completedIds, setCompletedIds] = React.useState<string[]>(passedIds);
  const firstOpen = course.modules.find((m) => !passedIds.includes(m.id))?.id ?? course.modules[0]?.id ?? "";
  const [activeModuleId, setActiveModuleId] = React.useState<string>(firstOpen);

  const markPassed = (id: string) => setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const total = course.modules.length;
  const completedCount = completedIds.filter((id) => course.modules.some((m) => m.id === id)).length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isFullyPrepared = completedCount === total;

  return (
    <div className="space-y-8">
      {/* ------------------------------------------- Course Overview Header --- */}
      <div className="rounded-lg border border-border bg-card/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-widest">
                Official Prep Course
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {course.estimatedHours} hours prep · {total} modules
              </span>
            </div>
            <h2 className="mt-2 font-editorial text-2xl font-normal sm:text-3xl">{course.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{course.description}</p>
          </div>

          <div className="w-full sm:w-60 rounded border border-border bg-background p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Preparation Progress</span>
              <span className="font-mono text-muted-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="mt-2 h-2" />
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {completedCount} of {total} modules completed
            </p>
          </div>
        </div>

        {/* Readiness Status Callout */}
        <div className="mt-5 border-t border-border/60 pt-4">
          {isFullyPrepared ? (
            <div className="flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                <strong>Course complete.</strong> Every module&apos;s knowledge check is passed — the exam is unlocked.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-foreground" />
              <span>
                <strong>How it works:</strong> study each module, practise on the recommended cases, then pass the module&apos;s knowledge check. The exam unlocks when all {total} modules are passed.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ Modules Accordion --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-editorial text-xl font-normal">Course Curriculum &amp; Study Modules</h3>
          <span className="font-mono text-xs text-muted-foreground">Click a module to study</span>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border bg-card/20">
          {course.modules.map((module) => {
            const isCompleted = completedIds.includes(module.id);
            const isOpen = activeModuleId === module.id;

            return (
              <div key={module.id} className="transition-colors hover:bg-card/50">
                {/* Module Bar */}
                <button
                  type="button"
                  onClick={() => setActiveModuleId(isOpen ? "" : module.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 text-muted-foreground" aria-label={isCompleted ? "Passed" : "Not passed yet"}>
                      {isCompleted ? (
                        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="size-5" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Module {module.order}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          {module.durationMinutes} min
                        </span>
                        {isCompleted && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[11px] text-emerald-600 dark:text-emerald-400">
                            Passed
                          </Badge>
                        )}
                      </div>
                      <h4 className="mt-1 font-editorial text-lg font-normal text-foreground sm:text-xl">
                        {module.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{module.summary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    {isOpen ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                  </div>
                </button>

                {/* Expanded Study Guide Details */}
                {isOpen && (
                  <div className="border-t border-border/70 bg-background/60 p-6 space-y-6">
                    {/* Core concepts tags */}
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Key Concepts Covered</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {module.keyConcepts.map((concept) => (
                          <span
                            key={concept}
                            className="rounded border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Overview description */}
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      {module.studyGuide.overview}
                    </div>

                    {/* Framework Steps Guide */}
                    <div className="rounded-lg border border-border bg-card p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <BookOpen className="size-4 text-mark" />
                        <span>{module.studyGuide.frameworkTitle}</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {module.studyGuide.frameworkSteps.map((stepItem, i) => (
                          <div key={i} className="rounded border border-border/70 bg-background p-3.5">
                            <p className="text-xs font-semibold text-foreground">{stepItem.step}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stepItem.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tips & Pitfalls */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Lightbulb className="size-4" />
                          <span>Pro Rules of Thumb</span>
                        </div>
                        <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                          {module.studyGuide.rulesOfThumb.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="size-4" />
                          <span>Exam Pitfalls to Avoid</span>
                        </div>
                        <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                          {module.studyGuide.commonPitfalls.map((pitfall, i) => (
                            <li key={i}>{pitfall}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Recommended Practice Cases */}
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                          Recommended Practice Cases for this Module
                        </p>
                        <span className="text-xs text-muted-foreground">Solve in library</span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {module.recommendedCases.map((rc) => (
                          <div
                            key={rc.slug}
                            className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] uppercase text-muted-foreground">
                                  {rc.companyTrack}
                                </span>
                                <Badge variant="outline" className={cn("text-[11px] capitalize", DIFFICULTY_CLASS[rc.difficulty])}>
                                  {rc.difficulty}
                                </Badge>
                              </div>
                              <h5 className="mt-2 font-medium text-sm leading-snug text-foreground group-hover:underline">
                                {rc.title}
                              </h5>
                              <p className="mt-1 text-xs text-muted-foreground">{rc.focus}</p>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                              <span className="font-mono text-[11px] text-muted-foreground">~{rc.estimatedMinutes} min</span>
                              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                                <Link href={`/cases/${rc.slug}`} target="_blank">
                                  Practice case <ArrowRight className="ml-1 size-3" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Self-check, then the graded knowledge check */}
                    <div className="space-y-1 border-t border-border/80 pt-4">
                      <p className="font-mono text-[11px] uppercase text-muted-foreground">Before the check, can you say yes to these?</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {module.checkpoints.map((cp, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">•</span> {cp}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {checks[module.id]?.length ? (
                      <div className="rounded-lg border border-border bg-card p-5">
                        <ModuleCheck
                          examSlug={course.examSlug}
                          moduleId={module.id}
                          questions={checks[module.id]}
                          passed={isCompleted}
                          signedIn={signedIn}
                          onPassed={markPassed}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------- Final Exam Transition CTA --- */}
      <div className="rounded-lg border-2 border-brand bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-mark" />
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Final Step · Capstone Assessment
              </p>
            </div>
            <h3 className="mt-1 font-editorial text-2xl font-normal">{examTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFullyPrepared
                ? "The course is done. Take the 2-case, 90-minute proctored exam to earn your verifiable certificate."
                : `Unlocks when all ${total} modules are passed — ${completedCount} of ${total} so far.`}
            </p>
          </div>
          <Button asChild variant={isFullyPrepared ? "ink" : "outline"} size="lg">
            <a href="#exam-sitting">{isFullyPrepared ? "Take the exam" : "See the exam"}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
