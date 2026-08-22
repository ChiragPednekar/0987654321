"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UniversityRow, UserRow } from "@/lib/types/database";

export function ProfileForm({
  profile,
  universities = [],
}: {
  profile: UserRow;
  /** Registry entries; free text is still allowed for anything not listed. */
  universities?: UniversityRow[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();

    // RLS restricts this update to the caller's own row, and there is no
    // policy allowing a user to change `role`, `ce` or any score column.
    const { error } = await supabase
      .from("users")
      .update({
        full_name: String(formData.get("full_name")).trim() || null,
        university: String(formData.get("university")).trim() || null,
        career_goal: String(formData.get("career_goal")).trim() || null,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Profile updated.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name ?? ""}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile.email} disabled />
        <p className="text-xs text-muted-foreground">
          Change your email from your account provider.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="university">University</Label>
        <Input
          id="university"
          name="university"
          list="university-options"
          defaultValue={profile.university ?? ""}
          placeholder="Start typing — or enter any school"
          maxLength={120}
          autoComplete="organization"
        />
        {universities.length > 0 && (
          <datalist id="university-options">
            {universities.map((u) => (
              <option key={u.id} value={u.short_name ?? u.name}>
                {u.name}
              </option>
            ))}
          </datalist>
        )}
        <p className="text-xs text-muted-foreground">
          Self-reported, and used for your campus leaderboard.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="career_goal">Career goal</Label>
        <Input
          id="career_goal"
          name="career_goal"
          defaultValue={profile.career_goal ?? ""}
          placeholder="e.g. Consulting at MBB, PM at a growth-stage SaaS"
          maxLength={160}
        />
      </div>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
