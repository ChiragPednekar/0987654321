"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { removeStored, useIsClient, useStored } from "@/hooks/use-browser-state";
import { PENDING_BATCH_CODE_KEY, joinBatch } from "./batch-code";
import { CampusKeyModal } from "./campus-key-modal";
import { IsometricCaseStack } from "./case-stack";
import { SignInForm } from "./sign-in-form";

/**
 * The sign-in page: the case-anatomy story on the left, the form on the
 * right. It carries its own obsidian palette (`.signin-theme` in globals.css)
 * and is dark unless the visitor has explicitly chosen light — "system"
 * renders dark here. The toggle writes through next-themes, so the choice is
 * the same one the rest of the app reads.
 */
export function SignInScreen({
  next,
  googleEnabled,
  signedInEmail,
  error,
  year,
}: {
  next: string;
  googleEnabled: boolean;
  signedInEmail: string | null;
  error: string | null;
  year: number;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();
  const light = mounted && theme === "light";
  const [campusOpen, setCampusOpen] = React.useState(false);
  const pendingCode = useStored(PENDING_BATCH_CODE_KEY);
  const signedIn = signedInEmail !== null;

  function toggleTheme() {
    setTheme(light ? "dark" : "light");
    toast(`Switched to CaseCode ${light ? "Dark" : "Light"} Theme`);
  }

  // Back from Google (or already signed in) with a batch key held from the
  // Campus Key dialog: redeem it now that there is a session.
  const redeeming = React.useRef(false);
  React.useEffect(() => {
    if (!signedIn || !pendingCode || redeeming.current) return;
    redeeming.current = true;
    void joinBatch(pendingCode).then((result) => {
      removeStored(PENDING_BATCH_CODE_KEY);
      if (result.ok) {
        toast.success(`Batch key ${pendingCode} verified — you've joined the batch.`);
        router.push(`/classrooms/${result.classroomId}`);
      } else {
        toast.error(`Batch key ${pendingCode}: ${result.error}`);
      }
    });
  }, [signedIn, pendingCode, router]);

  return (
    <div
      className={cn(
        "signin-page signin-theme relative min-h-screen overflow-x-hidden bg-cc-obsidian text-cc-ink antialiased transition-colors duration-300",
        light && "signin-light",
      )}
    >
      <div className="signin-ambient pointer-events-none fixed inset-0 z-0" aria-hidden />
      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b border-cc-border/40 bg-cc-obsidian/40 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5 lg:px-12">
          <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="CaseCode home">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cc-accent to-indigo-500 shadow-lg shadow-blue-500/20 ring-1 ring-white/20 transition-transform group-hover:scale-105">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-lg font-bold tracking-[-0.025em] text-cc-ink">
                CaseCode <span className="animate-pulse motion-reduce:animate-none h-1.5 w-1.5 rounded-full bg-cc-accent" />
              </span>
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.025em] text-cc-muted">
                Placement &amp; Case Engine
              </span>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-1.5 rounded-full border border-cc-accent/20 bg-cc-accent/10 px-2.5 py-1 text-[11px] text-cc-accent-ink md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Placement Portal Online
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
              className="flex min-h-9 items-center gap-2 rounded-full border border-cc-border bg-cc-card/70 px-3 py-1.5 text-xs font-medium text-cc-muted transition-all hover:bg-cc-surface hover:text-cc-ink"
            >
              <span aria-hidden>{light ? "🌙" : "☀️"}</span>
              <span className="hidden sm:inline">{light ? "Dark Mode" : "Light Mode"}</span>
            </button>
            <button
              type="button"
              onClick={() => setCampusOpen(true)}
              aria-label="Campus Key"
              className="flex min-h-9 items-center gap-1.5 px-1 text-xs text-cc-muted transition-colors hover:text-cc-accent"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden md:inline">Campus Key</span>
            </button>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 outline-none lg:grid-cols-12"
        >
          <section className="relative flex flex-col justify-between px-6 pb-10 pt-8 sm:px-10 lg:col-span-7 lg:border-r lg:border-cc-border/50 lg:px-16">
            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cc-accent/30 bg-cc-accent/10 px-3 py-1 text-xs font-semibold text-cc-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-cc-accent" />
                Deliberate Practice for MBAs
              </div>
              <h1 className="text-3xl font-semibold leading-[1.18] tracking-[-0.025em] text-cc-ink sm:text-4xl lg:text-5xl">
                Structure the problem or run the numbers.
                <span className="signin-serif mt-1 block font-normal italic text-cc-accent-ink">
                  We evaluate your frameworks, rigor, and delivery.
                </span>
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-cc-muted">
                From MECE market entry to leveraged buyout sensitivity tables—CaseCode simulates
                Tier-1 interviews with line-by-line rubric feedback.
              </p>
            </div>

            <IsometricCaseStack />
          </section>

          <section className="relative order-first flex flex-col justify-between border-b border-cc-border/50 bg-cc-canvas/40 px-6 py-10 lg:order-none lg:border-b-0 backdrop-blur-sm sm:px-12 lg:col-span-5 lg:px-16">
            <div className="my-auto w-full max-w-[420px] self-center py-4">
              <div className="mb-6">
                <h2 className="text-2xl font-bold leading-tight tracking-[-0.025em] text-cc-ink sm:text-[28px]">
                  Sign in to CaseCode
                </h2>
                <p className="mt-2 text-sm text-cc-ink-3">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup" className="font-medium text-cc-accent transition-colors hover:text-cc-accent-ink">
                    Create one
                  </Link>
                </p>
              </div>

              {signedInEmail && (
                <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-cc-border bg-cc-card px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-cc-ink">Already signed in</p>
                    <p className="truncate text-xs text-cc-muted">{signedInEmail}</p>
                  </div>
                  <Link
                    href={next}
                    className="shrink-0 rounded-lg bg-cc-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cc-accent-hover"
                  >
                    Go to {next === "/dashboard" ? "Dashboard" : "Page"}
                  </Link>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-cc-vermilion/40 bg-cc-vermilion/10 px-3.5 py-2.5 text-xs text-cc-ink"
                >
                  {error}
                </div>
              )}

              {pendingCode && !signedIn && (
                <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-cc-accent/30 bg-cc-accent/10 px-3.5 py-2.5 text-xs text-cc-ink-2">
                  <span>
                    Batch key <span className="font-mono text-cc-accent-ink">{pendingCode}</span> will
                    be verified after you sign in.
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStored(PENDING_BATCH_CODE_KEY)}
                    className="shrink-0 font-medium text-cc-muted hover:text-cc-ink"
                  >
                    Remove
                  </button>
                </div>
              )}

              <SignInForm next={next} googleEnabled={googleEnabled} pendingCode={pendingCode} />
            </div>
            <Copyright year={year} className="hidden lg:block" />
          </section>
        </main>
        {/* Below lg the form comes first, so the footer moves to the end. */}
        <Copyright year={year} className="px-6 pb-8 sm:px-10 lg:hidden" />
      </div>

      <CampusKeyModal open={campusOpen} onOpenChange={setCampusOpen} signedIn={signedIn} />
    </div>
  );
}

function Copyright({ year, className }: { year: number; className: string }) {
  return (
    <div className={cn("pt-6 text-right font-mono text-xs text-cc-muted", className)}>
      © {year} CaseCode. All rights reserved.
    </div>
  );
}
