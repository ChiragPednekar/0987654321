"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, ExternalLink, Loader2, MessageSquare, Plus, Sparkles, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Topic {
  id: string;
  title: string;
  prompt: string | null;
  category: string;
}

interface Batch {
  id: string;
  name: string;
}

export function TeacherGdDialog({
  topics,
  batches,
  defaultBatchId,
  triggerLabel = "Host group discussion",
  triggerVariant = "ink",
}: {
  topics: Topic[];
  batches: Batch[];
  defaultBatchId?: string;
  triggerLabel?: string;
  triggerVariant?: "ink" | "outline" | "default" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [topicMode, setTopicMode] = React.useState<"preset" | "custom">("preset");
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>(topics[0]?.id ?? "");
  const [customTitle, setCustomTitle] = React.useState("");
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [selectedBatchId, setSelectedBatchId] = React.useState<string>(defaultBatchId ?? "");
  const [joinPolicy, setJoinPolicy] = React.useState<"open" | "approval">("open");
  const [maxParticipants, setMaxParticipants] = React.useState<number>(6);
  const [busy, setBusy] = React.useState(false);

  // Created session result
  const [createdSession, setCreatedSession] = React.useState<{
    id: string;
    url: string;
    topicTitle: string;
    batchName?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedMessage, setCopiedMessage] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (topicMode === "custom" && customTitle.trim().length < 3) {
      toast.error("Please provide a topic title (at least 3 characters).");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/gd/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic_id: topicMode === "preset" ? selectedTopicId : undefined,
          custom_topic_title: topicMode === "custom" ? customTitle.trim() : undefined,
          custom_topic_prompt: topicMode === "custom" && customPrompt.trim() ? customPrompt.trim() : undefined,
          classroom_id: selectedBatchId ? selectedBatchId : undefined,
          join_policy: joinPolicy,
          max_participants: maxParticipants,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not create discussion room.");
        return;
      }

      const activeTopic = topicMode === "preset"
        ? topics.find((t) => t.id === selectedTopicId)?.title ?? "Group Discussion"
        : customTitle.trim();
      const activeBatch = batches.find((b) => b.id === selectedBatchId)?.name;

      const meetingUrl = `${window.location.origin}/gd/${data.id}`;
      setCreatedSession({
        id: data.id,
        url: meetingUrl,
        topicTitle: activeTopic,
        batchName: activeBatch,
      });

      toast.success("Group discussion room created!");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!createdSession) return;
    try {
      await navigator.clipboard.writeText(createdSession.url);
      setCopiedLink(true);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  }

  async function copyInviteMessage() {
    if (!createdSession) return;
    const msg = [
      `Group Discussion on CaseCode: ${createdSession.topicTitle}`,
      createdSession.batchName ? `Batch: ${createdSession.batchName}` : null,
      `Join link: ${createdSession.url}`,
      `Open on your browser (camera & mic ready). No proctoring needed.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(msg);
      setCopiedMessage(true);
      toast.success("Invite message copied for WhatsApp / Slack!");
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      toast.error("Could not copy message.");
    }
  }

  function handleReset() {
    setCreatedSession(null);
    setCustomTitle("");
    setCustomPrompt("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Video className="mr-1.5 size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-editorial text-2xl font-normal">
            Host a Group Discussion
          </DialogTitle>
          <DialogDescription className="text-xs">
            Start a live, Google Meet-style group discussion. Share the link with your students to practice discussion etiquette, framing, and arguments without proctoring.
          </DialogDescription>
        </DialogHeader>

        {createdSession ? (
          <div className="space-y-5 py-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Check className="size-4" />
                Discussion Room Ready
              </div>
              <p className="mt-1 font-editorial text-lg text-foreground">
                {createdSession.topicTitle}
              </p>
              {createdSession.batchName && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Assigned batch: {createdSession.batchName}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Meeting Link</label>
                <div className="mt-1 flex items-center gap-2">
                  <Input readOnly value={createdSession.url} className="font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Clipboard className="size-4" />}
                    {copiedLink ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={copyInviteMessage} className="text-xs">
                  {copiedMessage ? <Check className="mr-1.5 size-3.5" /> : <MessageSquare className="mr-1.5 size-3.5" />}
                  {copiedMessage ? "Copied invite text" : "Copy WhatsApp invite text"}
                </Button>
                <Button
                  variant="ink"
                  size="sm"
                  className="text-xs"
                  onClick={() => router.push(`/gd/${createdSession.id}`)}
                >
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Enter meeting room
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-4 text-right">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            {/* Topic selection mode */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Topic</label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTopicMode("preset")}
                    className={`rounded px-2 py-0.5 ${
                      topicMode === "preset"
                        ? "bg-action text-action-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Curated bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopicMode("custom")}
                    className={`rounded px-2 py-0.5 ${
                      topicMode === "custom"
                        ? "bg-action text-action-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Custom topic
                  </button>
                </div>
              </div>

              {topicMode === "preset" ? (
                <div className="mt-1.5">
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.category.toUpperCase()}] {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="mt-1.5 space-y-2">
                  <Input
                    placeholder="e.g. Will artificial intelligence replace junior analysts in finance?"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    required
                  />
                  <Textarea
                    placeholder="Optional background prompt or guidelines for students..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Target batch */}
            {batches.length > 0 && (
              <div>
                <label className="text-xs font-medium text-foreground">Batch (optional)</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring"
                >
                  <option value="">Open to any student with link</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Access policy */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">Who can join</label>
                <select
                  value={joinPolicy}
                  onChange={(e) => setJoinPolicy(e.target.value as "open" | "approval")}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring"
                >
                  <option value="open">Anyone with link (Direct join)</option>
                  <option value="approval">Private (Teacher admits each student)</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {joinPolicy === "open"
                    ? "Students enter directly without waiting."
                    : "Students knock and wait for your admission."}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Room capacity</label>
                <select
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring"
                >
                  <option value={4}>4 participants</option>
                  <option value={5}>5 participants</option>
                  <option value={6}>6 participants (Standard GD)</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Standard GDs run with 5-6 students.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="ink" disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
                Create discussion room
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
