"use client";

import * as React from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function GroupCodeBadge({ code, isOwner }: { code: string; isOwner: boolean }) {
  const [copied, setCopied] = React.useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`Invite code ${code} copied!`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-foreground">
      <KeyRound className="size-3.5 text-primary shrink-0" />
      <span>
        {isOwner ? "Invite Code:" : "Group Code:"}{" "}
        <span className="font-mono font-bold tracking-wider">{code}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={copyCode}
        className="size-6 text-muted-foreground hover:text-foreground"
        title="Copy invite code"
      >
        {copied ? (
          <Check className="size-3 text-emerald-500" />
        ) : (
          <Copy className="size-3" />
        )}
      </Button>
    </div>
  );
}
