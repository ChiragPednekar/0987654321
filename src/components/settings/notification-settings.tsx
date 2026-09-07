"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bell, Flame, GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NotificationConfig {
  assignments: boolean;
  groupDiscussions: boolean;
  streakReminders: boolean;
  weeklyPerformanceDigest: boolean;
}

const STORAGE_KEY = "casecode_notification_config";

const DEFAULT_CONFIG: NotificationConfig = {
  assignments: true,
  groupDiscussions: true,
  streakReminders: true,
  weeklyPerformanceDigest: false,
};

export function NotificationSettings() {
  const [config, setConfig] = React.useState<NotificationConfig>(DEFAULT_CONFIG);

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

  function toggle(key: keyof NotificationConfig) {
    const updated = { ...config, [key]: !config[key] };
    setConfig(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success("Notification preferences updated.");
    } catch {
      toast.error("Could not update notifications.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          Notifications & Alerts
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Choose when and how CaseCode updates you about homework, cohorts, and your streak.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 divide-y divide-border/60 text-sm">
        {/* Batch Assignments */}
        <div className="flex items-center justify-between gap-4 pt-3 first:pt-0">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-muted-foreground" />
              Classroom & Assignment Deadlines
            </span>
            <p className="text-xs text-muted-foreground">
              Notify when an instructor posts a new case drill, grades your work, or requests revisions.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.assignments}
            onChange={() => toggle("assignments")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Group Discussions */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-muted-foreground" />
              Cohort & Study Group Posts
            </span>
            <p className="text-xs text-muted-foreground">
              Notify when fellow members in your private or public groups post questions or mock interview invites.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.groupDiscussions}
            onChange={() => toggle("groupDiscussions")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Daily Streak Reminders */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Flame className="size-3.5 text-amber-500" />
              Daily Practice Streak Reminder
            </span>
            <p className="text-xs text-muted-foreground">
              Evening nudge if you haven&apos;t completed a drill today to keep your streak active.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.streakReminders}
            onChange={() => toggle("streakReminders")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>

        {/* Weekly Digest */}
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">
              Weekly Performance Digest
            </span>
            <p className="text-xs text-muted-foreground">
              Weekly recap of your CE score growth, global leaderboard rank, and suggested focus areas.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.weeklyPerformanceDigest}
            onChange={() => toggle("weeklyPerformanceDigest")}
            className="size-4 rounded border-border accent-primary cursor-pointer"
          />
        </div>
      </CardContent>
    </Card>
  );
}
