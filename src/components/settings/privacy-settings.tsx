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

const STORAGE_KEY = "casecode_privacy_config";

const DEFAULT_CONFIG: PrivacyConfig = {
  showOnLeaderboard: true,
  shareHistoryWithCohort: true,
  showCollegeAffiliation: true,
};

export function PrivacySettings() {
  const [config, setConfig] = React.useState<PrivacyConfig>(DEFAULT_CONFIG);

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

  function toggle(key: keyof PrivacyConfig) {
    const updated = { ...config, [key]: !config[key] };
    setConfig(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success("Privacy preferences updated.");
    } catch {
      toast.error("Could not update privacy setting.");
    }
  }

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
