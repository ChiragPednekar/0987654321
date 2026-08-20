"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, Bell, CheckCheck, MessageSquare, Trophy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationRow, NotificationType } from "@/lib/types/database";

const ICON: Record<NotificationType, typeof Bell> = {
  grade_ready: CheckCheck,
  badge_earned: Award,
  level_up: Trophy,
  contest_starting: Trophy,
  contest_result: Trophy,
  comment_reply: MessageSquare,
  system: Bell,
};

export function NotificationBell({
  initial,
  unreadCount,
}: {
  initial: NotificationRow[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [unread, setUnread] = React.useState(unreadCount);

  // The server is the source of truth; re-sync when props change after a
  // router.refresh() elsewhere in the app.
  React.useEffect(() => {
    setItems(initial);
    setUnread(unreadCount);
  }, [initial, unreadCount]);

  async function markAllRead() {
    if (unread === 0) return;

    // Optimistic: the badge should clear the instant it is clicked.
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    setUnread(0);

    const response = await fetch("/api/notifications/read", { method: "POST" });
    if (!response.ok) {
      setItems(initial);
      setUnread(unreadCount);
      return;
    }
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          className="relative rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="size-6 text-muted-foreground/40" />
            <p className="text-sm font-medium">Nothing yet</p>
            <p className="text-xs text-muted-foreground">
              Grades, badges and contest results land here.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.slice(0, 8).map((item) => {
              const Icon = ICON[item.type] ?? Bell;
              const body = (
                <div
                  className={cn(
                    "flex gap-2.5 px-3 py-2.5",
                    !item.read_at && "bg-primary/[0.04]",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.body && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {item.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {timeAgo(item.created_at)}
                    </p>
                  </div>
                  {!item.read_at && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              );

              // Only ever link to an in-app path — see the href column comment.
              return (
                <li key={item.id}>
                  {item.href?.startsWith("/") ? (
                    <Link href={item.href} className="block hover:bg-accent/50">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
