"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Clock, Code2, Sparkles, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PracticeConfig {
  autoTimer: boolean;
  timerMinutes: number;
  autoSaveScratchpad: boolean;
  financialShorthand: boolean;
  editorFontSize: "small" | "medium" | "large";
  instantNextQuestion: boolean;
}

const STORAGE_KEY = "casecode_practice_config";

const DEFAULT_CONFIG: PracticeConfig = {
  autoTimer: true,
  timerMinutes: 30,
  autoSaveScratchpad: true,
  financialShorthand: true,
  editorFontSize: "medium",
  instantNextQuestion: true,
};

export function PracticePreferences() {
  const [config, setConfig] = React.useState<PracticeConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  function update<K extends keyof PracticeConfig>(key: K, value: PracticeConfig[K]) {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSaved(true);
      toast.success("Practice preference updated.");
      setTimeout(() => setSaved(false), 1500);
    } catch {
      toast.error("Could not save preference.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="size-4 text-primary" />
            Practice & Solver Environment
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Customize how drills, timers, and your case scratchpad behave during live interviews.
          </p>
        </div>
        {saved ? (
          <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
            <Check className="size-3" /> Saved
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 divide-y divide-border/60 text-sm">
        {/* Auto Timer */}
        <div className="flex items-center justify-between gap-4 pt-3 first:pt-0">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              Automatic Practice Countdown Timer
            </span>
            <p className="text-xs text-muted-foreground">
              Automatically starts a 30-minute interview countdown clock when opening any case drill.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.autoTimer}
            onChange={(e) => update("autoTimer", e.target.checked)}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Scratchpad Auto-save */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Code2 className="size-3.5 text-muted-foreground" />
              Continuous Scratchpad Auto-Save
            </span>
            <p className="text-xs text-muted-foreground">
              Periodically saves your framework structure and calculations to local storage to prevent data loss.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.autoSaveScratchpad}
            onChange={(e) => update("autoSaveScratchpad", e.target.checked)}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Auto Next Question */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-muted-foreground" />
              Prompt Next Question on Completion
            </span>
            <p className="text-xs text-muted-foreground">
              Shows prominent &ldquo;Next question →&rdquo; jump buttons in learning paths after evaluation.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.instantNextQuestion}
            onChange={(e) => update("instantNextQuestion", e.target.checked)}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Financial Shorthand */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">
              Financial Notation Shorthand ($M / $B)
            </span>
            <p className="text-xs text-muted-foreground">
              Format large numbers using consulting standard abbreviations ($12.5M, $1.4B) instead of long decimals.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.financialShorthand}
            onChange={(e) => update("financialShorthand", e.target.checked)}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Font Size */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">
              Solver Workspace Font Size
            </span>
            <p className="text-xs text-muted-foreground">
              Adjust text scale inside the problem prompt and code editor.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["small", "medium", "large"] as const).map((size) => (
              <Button
                key={size}
                type="button"
                variant={config.editorFontSize === size ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs capitalize"
                onClick={() => update("editorFontSize", size)}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
