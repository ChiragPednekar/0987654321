"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type CaseOption = { id: string; title: string; domain: string };

/**
 * Opens a room: pick a case, pick which side you want, wait for a partner.
 *
 * The case is searched rather than listed — there are 886 of them, and a
 * dropdown that long is a worse experience than typing three letters.
 */
export function OpenRoomForm() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CaseOption[]>([]);
  const [chosen, setChosen] = React.useState<CaseOption | null>(null);
  const [role, setRole] = React.useState<"candidate" | "interviewer">("candidate");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("cases")
        .select("id, title, domain")
        .ilike("title", `%${query.trim()}%`)
        .eq("is_published", true)
        .limit(8);
      setResults((data as CaseOption[]) ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function open() {
    if (!chosen) return;
    setBusy(true);
    try {
      const response = await fetch("/api/peer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: chosen.id, host_role: role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not open the room.");
      router.push(`/peer/${data.session_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the room.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor="peer-case" className="text-sm font-medium">
            Which case?
          </label>
          <Input
            id="peer-case"
            value={chosen ? chosen.title : query}
            onChange={(e) => {
              setChosen(null);
              setQuery(e.target.value);
            }}
            placeholder="Search the case library by title…"
          />
          {!chosen && results.length > 0 && (
            <ul className="mt-1 divide-y divide-border rounded-md border border-border">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(c);
                      setResults([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">You want to</span>
          <div className="flex gap-2">
            {(
              [
                { value: "candidate", label: "Be interviewed", hint: "You solve the case" },
                { value: "interviewer", label: "Interview", hint: "You get the model answer" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                className={
                  "flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors " +
                  (role === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80")
                }
              >
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={open} disabled={!chosen || busy} className="w-full">
          <Plus className="size-4" />
          {busy ? "Opening…" : "Open a room"}
        </Button>
      </CardContent>
    </Card>
  );
}
