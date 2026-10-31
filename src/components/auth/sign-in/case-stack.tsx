"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The anatomy of a graded case as an exploded isometric stack: the prompt and
 * its issue tree on top, then the numbers, the synthesis, and the examiner's
 * rubric at the base. Purely illustrative, so the layers are hidden from
 * assistive tech; the expand button carries the state.
 *
 * The layers keep their dark "product screenshot" look in both themes.
 */
export function IsometricCaseStack() {
  const [expanded, setExpanded] = React.useState(false);
  const [tilt, setTilt] = React.useState<{ x: number; y: number } | null>(null);

  const toggle = React.useCallback(() => setExpanded((value) => !value), []);

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (expanded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
    });
  }

  const transform =
    tilt && !expanded
      ? `rotateX(${54.7 + tilt.y * 12}deg) rotateZ(${-45 + tilt.x * 12}deg)`
      : undefined;

  return (
    <div className="relative my-10 flex flex-col items-center justify-center lg:my-8">
      <div className="z-20 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={expanded}
          className="flex items-center gap-2 rounded-full border border-cc-border bg-cc-card/90 px-3.5 py-1.5 text-xs text-cc-muted shadow-sm transition-all hover:border-cc-accent hover:text-cc-ink"
        >
          <svg className="h-3.5 w-3.5 text-cc-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{expanded ? "Collapse Stack" : "Inspect Case Anatomy"}</span>
          <span className="rounded bg-cc-surface px-1.5 py-0.5 text-[10px] text-cc-accent-ink">
            {expanded ? "Click to collapse" : "Click to expand"}
          </span>
        </button>
        <span className="hidden text-xs italic text-cc-muted sm:inline" aria-live="polite">
          {expanded ? "Status: Expanded (4 Rubric Layers)" : "Layer: All stacked"}
        </span>
      </div>

      {/* Scaled rather than resized on phones: the stack's geometry is in px. */}
      <div className="flex h-[290px] w-full items-center justify-center sm:h-[380px]">
        <div
          className="isometric-stage flex h-[340px] w-full max-w-[460px] origin-center scale-[0.78] items-center justify-center sm:h-[380px] sm:scale-100"
          onMouseMove={handleMove}
          onMouseLeave={() => setTilt(null)}
        >
          <div
            aria-hidden
            onClick={toggle}
            title="Click to inspect layered case components"
            style={{ transform }}
            className={cn(
              "isometric-stack relative h-64 w-64 cursor-pointer",
              expanded && "is-expanded",
            )}
          >
            <PromptLayer />
            <SensitivityLayer />
            <SynthesisLayer />
            <RubricLayer />
          </div>
        </div>
      </div>
    </div>
  );
}

function StackLayer({
  depth,
  className,
  children,
}: {
  depth: 1 | 2 | 3 | 4;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        `isometric-layer layer-${depth} absolute inset-0 rounded-2xl border p-4 backdrop-blur-md`,
        className,
      )}
    >
      {children}
    </div>
  );
}

const TREE = [
  { label: "├─ Market Attractiveness ($4.8B TAM)", status: "Valid", tone: "text-emerald-400" },
  { label: "├─ Unit Economics & TCO Parity", status: "Calculated", tone: "text-blue-400" },
  { label: "└─ CapEx Horizon & Fleet Depreciation", status: "Review", tone: "text-amber-400" },
];

function PromptLayer() {
  return (
    <StackLayer depth={1} className="border-blue-500/40 bg-[#161c2d]/95 shadow-isometric hover:border-blue-400">
      <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-semibold tracking-[0.025em] text-white">CASE: EV FLEET ENTRY</span>
        </div>
        <span className="rounded bg-blue-500/20 px-2 py-0.5 font-mono text-[9px] text-blue-300">STAGE 1/3</span>
      </div>
      <div className="space-y-1.5 font-mono text-[10px] text-slate-300">
        {TREE.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between rounded border border-white/5 bg-white/5 p-1.5",
              i === TREE.length - 1 && "text-[#717c99]",
            )}
          >
            <span>{row.label}</span>
            <span className={cn("font-sans text-[9px]", row.tone)}>{row.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between pt-1 text-[9px] text-[#717c99]">
        <span>Structured MECE Logic</span>
        <span className="font-medium text-blue-400">Auto-Synthesizing →</span>
      </div>
    </StackLayer>
  );
}

const SENSITIVITY: { value: string; tone: string }[] = [
  { value: "Miles/Yr", tone: "bg-white/5 text-slate-400" },
  { value: "Base", tone: "bg-white/5 text-slate-400" },
  { value: "+15%", tone: "bg-white/5 text-slate-400" },
  { value: "-15%", tone: "bg-white/5 text-slate-400" },
  { value: "45k", tone: "bg-white/5 text-slate-400" },
  { value: "$1.42", tone: "bg-blue-600/30 font-semibold text-blue-200" },
  { value: "$1.22", tone: "bg-emerald-500/20 text-emerald-300" },
  { value: "$1.68", tone: "bg-rose-500/20 text-rose-300" },
  { value: "60k", tone: "bg-white/5 text-slate-400" },
  { value: "$1.18", tone: "bg-emerald-500/20 text-emerald-300" },
  { value: "$0.98", tone: "bg-emerald-500/30 font-semibold text-emerald-200" },
  { value: "$1.39", tone: "bg-amber-500/20 text-amber-300" },
];

function SensitivityLayer() {
  return (
    <StackLayer depth={2} className="border-indigo-500/30 bg-[#121624]/95 shadow-isometric hover:border-indigo-400">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-[11px] font-semibold tracking-[0.025em] text-slate-200">FINANCIAL SENSITIVITY</span>
        <span className="font-mono text-[9px] text-indigo-300">IRR: 24.2%</span>
      </div>
      <div className="my-2 grid grid-cols-4 gap-1 text-center font-mono text-[9px]">
        {SENSITIVITY.map((cell, i) => (
          <span key={i} className={cn("rounded p-1", cell.tone)}>
            {cell.value}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
        <span>Break-even: 19 Months</span>
        <span className="text-indigo-400">Rigor Score: 96%</span>
      </div>
    </StackLayer>
  );
}

function SynthesisLayer() {
  return (
    <StackLayer depth={3} className="border-slate-700/60 bg-[#0f131f]/95 shadow-isometric hover:border-slate-500">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-300">Executive Synthesis</span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] text-slate-300">Minto Pyramid</span>
      </div>
      <div className="space-y-1.5 text-[9px] text-slate-300">
        <div className="flex items-center gap-1.5 font-medium text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Lead with Recommendation: Enter Tier-2 Metro Feeder
        </div>
        <p className="pl-3 text-[8.5px] leading-tight text-slate-400">
          Phased rollout hedges battery replacement degradation risk while capturing 38% fleet
          electrification subsidies.
        </p>
        <div className="mt-2 flex gap-1">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] text-slate-300">Risks Managed</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] text-slate-300">3-Yr ROI Clear</span>
        </div>
      </div>
    </StackLayer>
  );
}

const RUBRIC = [
  { criterion: "Problem Structuring (MECE)", score: "28/30" },
  { criterion: "Quantitative Rigor & Math", score: "33/35" },
  { criterion: "Synthesis & Pushback Defense", score: "31/35" },
];

function RubricLayer() {
  return (
    <StackLayer depth={4} className="border-[#f95738]/50 bg-[#150e11]/95 shadow-glow-vermilion hover:border-[#f95738]">
      <div className="mb-2 flex items-center justify-between border-b border-[#f95738]/20 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="animate-pulse motion-reduce:animate-none h-2 w-2 rounded-full bg-[#f95738]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#f95738]">Examiner Rubric</span>
        </div>
        <span className="font-mono text-xs font-bold text-[#f95738]">Score: 92/100</span>
      </div>
      <div className="space-y-1 text-[9px]">
        {RUBRIC.map((row) => (
          <div key={row.criterion} className="flex items-center justify-between text-slate-300">
            <span>{row.criterion}</span>
            <span className="font-semibold text-[#f95738]">{row.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-[#f95738]/20 pt-2 text-[8.5px] italic text-amber-200/90">
        <span>&ldquo;Benchmark: Top 4% of Cohort&rdquo;</span>
        <span className="text-[9px] font-semibold not-italic text-[#f95738]">Verified</span>
      </div>
    </StackLayer>
  );
}
