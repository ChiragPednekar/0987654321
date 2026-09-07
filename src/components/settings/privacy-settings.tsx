"use client";

import * as React from "react";
import { toast } from "sonner";
import { Eye, Shield, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PrivacyConfig {
  showOnLeaderboard: boolean;
  shareHistoryWithCohort: boolean;
  showCollegeAffiliation: boolean;
}

/** Maps the UI keys to the columns the server stores them in. */
const COLUMN: Record<keyof PrivacyConfig, string> = {
  showOnLeaderboard: "show_on_leaderboard",
  shareHistoryWithCohort: "share_history_with_cohort",
  showCollegeAffiliation: "show_college_affiliation",
};

/**
 * Privacy preferences, saved on the server.
 *
 * These were held in localStorage: the panel reported "Privacy preferences
 * updated." while the server never heard about it, so switching off "Show on
 * leaderboard" left the user on the leaderboard for everyone, and the choice
 * did not follow them to another browser. A privacy control that changes
 * nothing anyone else can see is not a privacy control.
 *
 * The current values are passed in from the server so the toggles open showing
 * what is actually true, rather than a default that may be a lie.
 */
export function PrivacySettings({ initial }: { initial?: Partial<PrivacyConfig> }) {
  const [config, setConfig] = React.useState<PrivacyConfig>({
    showOnLeaderboard: initial?.showOnLeaderboard ?? true,
    shareHistoryWithCohort: initial?.shareHistoryWithCohort ?? true,
    showCollegeAffiliation: initial?.showCollegeAffiliation ?? true,
  });
  const [saving, setSaving] = React.useState(false);

  async function toggle(key: keyof PrivacyConfig) {
    const next = !config[key];
    const previous = config;

    // Optimistic: a toggle that lags feels broken. Reverted if the save fails,
    // because showing it off while the server has it on is the bug this whole
    // change exists to remove.
    setConfig({ ...config, [key]: next });
    setSaving(true);
    try {
      const response = await fetch("/api/settings/privacy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [COLUMN[key]]: next }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setConfig(previous);
        toast.error(payload.error ?? "Could not update privacy setting.");
        return;
      }
      toast.success(
        key === "showOnLeaderboard" && !next
          ? "Removed from the leaderboards."
          : "Privacy preferences updated.",
      );
    } catch {
      setConfig(previous);
      toast.error("Network error — nothing was changed.");
    } finally {
      setSaving(false);
    }
  }
  void saving;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="size-4 text-primary" />
          Privacy & Public Profile
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Control how your rank, university, and performance appear to peers and recruiters.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 divide-y divide-border/60 text-sm">
        {/* Leaderboard visibility */}
        <div className="flex items-center justify-between gap-4 pt-3 first:pt-0">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Trophy className="size-3.5 text-amber-500" />
              Global Platform Leaderboard Visibility
            </span>
            <p className="text-xs text-muted-foreground">
              Display your full name and CE score on the platform-wide student leaderboard. When disabled, your rank appears as &ldquo;Anonymous Candidate&rdquo;.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.showOnLeaderboard}
            onChange={() => toggle("showOnLeaderboard")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Cohort sharing */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-muted-foreground" />
              Cohort Activity Sharing
            </span>
            <p className="text-xs text-muted-foreground">
              Allow members of your study groups and classroom batches to see cases solved and recent milestones.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.shareHistoryWithCohort}
            onChange={() => toggle("shareHistoryWithCohort")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* College affiliation */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Eye className="size-3.5 text-muted-foreground" />
              University & Campus Badge
            </span>
            <p className="text-xs text-muted-foreground">
              Show your university affiliation badge next to your name on public posts and cohort rosters.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.showCollegeAffiliation}
            onChange={() => toggle("showCollegeAffiliation")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>
      </CardContent>
    </Card>
  );
}
