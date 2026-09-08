"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, HardDrive, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DataManagement({ userEmail, userName }: { userEmail: string; userName?: string | null }) {
  const [clearing, setClearing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  function clearDrafts() {
    setClearing(true);
    try {
      // Clear localStorage keys related to scratchpads and drafts
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("case_draft_") || key.startsWith("scratchpad_") || key.includes("draft"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      toast.success(`Cleared ${keysToRemove.length} local scratchpad draft(s).`);
    } catch {
      toast.error("Could not clear local drafts.");
    } finally {
      setClearing(false);
    }
  }

  function exportUserData() {
    setExporting(true);
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        user: {
          name: userName ?? "Anonymous",
          email: userEmail,
        },
        settings: {
          practiceConfig: localStorage.getItem("casecode_practice_config"),
          notifications: localStorage.getItem("casecode_notification_config"),
          privacy: localStorage.getItem("casecode_privacy_config"),
        },
        platform: "CaseCode Interview Preparation",
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `casecode_data_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Account data exported successfully!");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HardDrive className="size-4 text-primary" />
          Data & Local Storage
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Manage locally cached case scratchpads, browser drafts, and export your personal account data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 divide-y divide-border/60 text-sm">
        {/* Export Data */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Download className="size-3.5 text-muted-foreground" />
              Export My Data (JSON)
            </span>
            <p className="text-xs text-muted-foreground">
              Download a machine-readable JSON archive of your preferences, cohort profile, and practice configurations.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportUserData}
            disabled={exporting}
            className="shrink-0 text-xs"
          >
            Export Archive
          </Button>
        </div>

        {/* Clear Local Drafts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Trash2 className="size-3.5 text-muted-foreground" />
              Clear Local Scratchpad Drafts
            </span>
            <p className="text-xs text-muted-foreground">
              Deletes cached offline case notes and temporary response drafts stored in your current browser.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearDrafts}
            disabled={clearing}
            className="shrink-0 text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
          >
            {clearing ? "Clearing…" : "Clear Drafts"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
