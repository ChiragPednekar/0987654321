"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ExpertProfileValues {
  display_name: string;
  headline: string;
  bio: string;
  expertise: string[];
  linkedin_url: string;
  meeting_url: string;
  price_rupees: number;
}

/**
 * The expert profile, used to apply (POST /api/experts/apply) and later to
 * edit (PATCH /api/experts/me). The price is the expert's; CaseCode's share is
 * shown so nobody is surprised by the payout.
 */
export function ExpertProfileForm({
  mode,
  initial,
  expertise,
  priceRange,
  commissionPct,
}: {
  mode: "apply" | "edit";
  initial: ExpertProfileValues;
  expertise: readonly string[];
  priceRange: { min: number; max: number };
  commissionPct: number;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof ExpertProfileValues>(key: K, value: ExpertProfileValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(mode === "apply" ? "/api/experts/apply" : "/api/experts/me", {
        method: mode === "apply" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          linkedin_url: values.linkedin_url.trim() || null,
          meeting_url: values.meeting_url.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not save.");
        return;
      }
      toast.success(mode === "apply" ? "Application sent. We'll review it shortly." : "Profile saved.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const payout = Math.round(values.price_rupees * (1 - commissionPct / 100));

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="display_name">Name shown to students</Label>
          <Input id="display_name" value={values.display_name} onChange={(e) => set("display_name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={values.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="Ex-McKinsey Engagement Manager · IIM A"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">About you</Label>
        <Textarea
          id="bio"
          value={values.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Where you've worked, how many interviews you've given or sat, what a session with you is like."
          className="min-h-[120px]"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">What you interview for (up to 5)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {expertise.map((area) => {
            const on = values.expertise.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() =>
                  set("expertise", on ? values.expertise.filter((a) => a !== area) : [...values.expertise, area].slice(0, 5))
                }
                className={cn(
                  "border px-3 py-1 text-xs",
                  on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
                )}
              >
                {area}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="linkedin_url">LinkedIn (https://)</Label>
          <Input id="linkedin_url" value={values.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meeting_url">Meeting link students join (Meet, Zoom)</Label>
          <Input id="meeting_url" value={values.meeting_url} onChange={(e) => set("meeting_url", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="price">Price per session (₹)</Label>
        <Input
          id="price"
          type="number"
          min={priceRange.min}
          max={priceRange.max}
          step={100}
          value={values.price_rupees}
          onChange={(e) => set("price_rupees", Number(e.target.value))}
          className="max-w-[12rem]"
        />
        <p className="text-xs text-muted-foreground">
          ₹{priceRange.min.toLocaleString("en-IN")}–₹{priceRange.max.toLocaleString("en-IN")}. You receive ₹
          {payout.toLocaleString("en-IN")} per session; CaseCode keeps {commissionPct}%.
        </p>
      </div>
      <Button type="submit" variant="ink" disabled={busy || values.expertise.length === 0}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {mode === "apply" ? "Send application" : "Save profile"}
      </Button>
    </form>
  );
}
