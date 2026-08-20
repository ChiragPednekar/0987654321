"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Editor preferences are stored in localStorage rather than the database:
 * they are per-device by nature, and a font-size tweak should not need a
 * network round trip. The answer editor reads the same keys.
 */
const PREF_KEYS = {
  fontSize: "casecode:editor-font-size",
  lineHeight: "casecode:editor-line-height",
} as const;

const FONT_SIZES = [
  { value: "13", label: "Small" },
  { value: "14", label: "Normal" },
  { value: "16", label: "Large" },
];

const LINE_HEIGHTS = [
  { value: "1.5", label: "Compact" },
  { value: "1.7", label: "Normal" },
  { value: "2", label: "Relaxed" },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [fontSize, setFontSize] = React.useState("14");
  const [lineHeight, setLineHeight] = React.useState("1.7");

  // next-themes resolves on the client; rendering before that flashes the
  // wrong option as selected.
  React.useEffect(() => {
    setMounted(true);
    setFontSize(window.localStorage.getItem(PREF_KEYS.fontSize) ?? "14");
    setLineHeight(window.localStorage.getItem(PREF_KEYS.lineHeight) ?? "1.7");
  }, []);

  function updateFontSize(value: string) {
    setFontSize(value);
    window.localStorage.setItem(PREF_KEYS.fontSize, value);
  }

  function updateLineHeight(value: string) {
    setLineHeight(value);
    window.localStorage.setItem(PREF_KEYS.lineHeight, value);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field label="Theme">
          <div className="flex gap-2">
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition-colors",
                  mounted && theme === option.value
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={mounted && theme === option.value}
              >
                <option.icon className="size-4" />
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Editor font size"
          hint="Applies to the answer editor on case pages."
        >
          <Options
            options={FONT_SIZES}
            value={fontSize}
            onChange={updateFontSize}
          />
        </Field>

        <Field label="Editor line height">
          <Options
            options={LINE_HEIGHTS}
            value={lineHeight}
            onChange={updateLineHeight}
          />
        </Field>

        <div
          className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-muted-foreground"
          style={{ fontSize: `${fontSize}px`, lineHeight }}
        >
          Runway = cash ÷ monthly burn = ₹14 Cr ÷ ₹1.0 Cr = 14 months.
          <br />
          Burn multiple = 12 ÷ 40 = 0.3, so growth is being bought efficiently.
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Options({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            value === option.value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
