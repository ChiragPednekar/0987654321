"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowBigUp, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials, timeAgo } from "@/lib/utils";

export interface DiscussionComment {
  id: string;
  body: string;
  upvotes: number;
  created_at: string;
  parent_id: string | null;
  author: { full_name: string | null; avatar_url: string | null } | null;
  viewer_has_voted: boolean;
}

export function Discussion({
  caseId,
  comments,
  signedIn,
}: {
  caseId: string;
  comments: DiscussionComment[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<string | null>(null);

  // Optimistic vote state, keyed by comment id.
  const [votes, setVotes] = React.useState<
    Record<string, { count: number; voted: boolean }>
  >(() =>
    Object.fromEntries(
      comments.map((c) => [
        c.id,
        { count: c.upvotes, voted: c.viewer_has_voted },
      ]),
    ),
  );

  async function post() {
    if (!body.trim()) return;
    setPosting(true);

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ case_id: caseId, body, parent_id: replyTo }),
    });

    setPosting(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.error ?? "Could not post that.");
      return;
    }

    setBody("");
    setReplyTo(null);
    router.refresh();
  }

  async function toggleVote(commentId: string) {
    if (!signedIn) {
      toast.error("Log in to vote.");
      return;
    }

    const current = votes[commentId] ?? { count: 0, voted: false };
    const next = {
      count: current.voted ? current.count - 1 : current.count + 1,
      voted: !current.voted,
    };

    setVotes((prev) => ({ ...prev, [commentId]: next }));

    const response = await fetch(`/api/comments/${commentId}/vote`, {
      method: "POST",
    });

    if (!response.ok) {
      // Roll back on failure so the UI never lies about the count.
      setVotes((prev) => ({ ...prev, [commentId]: current }));
      toast.error("Vote failed.");
    }
  }

  const roots = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.reduce<Record<string, DiscussionComment[]>>(
    (acc, comment) => {
      if (comment.parent_id) {
        (acc[comment.parent_id] ??= []).push(comment);
      }
      return acc;
    },
    {},
  );

  function renderComment(comment: DiscussionComment, depth = 0) {
    const vote = votes[comment.id] ?? {
      count: comment.upvotes,
      voted: comment.viewer_has_voted,
    };

    return (
      <li key={comment.id} className={cn(depth > 0 && "ml-6 border-l border-border pl-4")}>
        <div className="flex gap-3 py-3">
          <Avatar className="size-7 shrink-0">
            {comment.author?.avatar_url && (
              <AvatarImage src={comment.author.avatar_url} alt="" />
            )}
            <AvatarFallback className="text-[10px]">
              {initials(comment.author?.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">
                {comment.author?.full_name ?? "Anonymous"}
              </span>
              <span className="text-xs text-muted-foreground">
                {timeAgo(comment.created_at)}
              </span>
            </div>

            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
              {comment.body}
            </p>

            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => toggleVote(comment.id)}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
                  vote.voted
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={vote.voted}
                aria-label="Upvote"
              >
                <ArrowBigUp className="size-3.5" />
                <span className="tabular">{vote.count}</span>
              </button>

              {signedIn && depth === 0 && (
                <button
                  onClick={() =>
                    setReplyTo(replyTo === comment.id ? null : comment.id)
                  }
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reply
                </button>
              )}
            </div>

            {replyTo === comment.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write a reply…"
                  className="min-h-20 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
                    {posting && <Loader2 className="animate-spin" />}
                    Reply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {repliesByParent[comment.id] && (
          <ul>
            {repliesByParent[comment.id].map((reply) =>
              renderComment(reply, depth + 1),
            )}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {signedIn && replyTo === null && (
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Ask a question or share how you approached this…"
            className="min-h-24 text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
              {posting && <Loader2 className="animate-spin" />}
              Post
            </Button>
          </div>
        </div>
      )}

      {roots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <MessageSquare className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No discussion yet. Start it.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {roots.map((comment) => renderComment(comment))}
        </ul>
      )}
    </div>
  );
}
