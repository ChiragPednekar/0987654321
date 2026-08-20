import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/notifications");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data ?? []) as NotificationRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grades, badges, contests and replies.
      </p>

      {items.length === 0 ? (
        <Card className="mt-6">
          <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
            <Bell className="size-8 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Nothing yet</p>
              <p className="text-sm text-muted-foreground">
                Submit a case and your grade will show up here.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/cases">Browse cases</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const body = (
                <div
                  className={cn(
                    "px-4 py-3",
                    !item.read_at && "bg-primary/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate text-sm font-medium">
                      {item.title}
                    </p>
                    {!item.read_at && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                  {item.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.body}
                    </p>
                  )}
                </div>
              );

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
        </Card>
      )}
    </div>
  );
}
