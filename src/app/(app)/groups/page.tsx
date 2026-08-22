import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Lock, Users } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateGroupForm } from "@/components/groups/create-group-form";

export const metadata: Metadata = {
  title: "Groups",
  description: "Study groups and communities on CaseCode.",
};

export default async function GroupsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/groups");

  const supabase = await createClient();

  // RLS already hides private groups the viewer is not in, so this needs no
  // extra filter — the policy is the filter.
  const [{ data: groups }, { data: mine }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, slug, name, description, is_private, member_count")
      .order("member_count", { ascending: false })
      .limit(50),
    supabase.from("group_members").select("group_id").eq("user_id", profile.id),
  ]);

  const joined = new Set((mine ?? []).map((m) => m.group_id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Study groups, campus cohorts and interview prep circles.
          </p>
        </div>
        <CreateGroupForm />
      </div>

      {!groups || groups.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No groups yet. Create the first one.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.slug}`} className="block">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-medium">{group.name}</h2>
                      {group.is_private ? (
                        <Lock
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="Private group"
                        />
                      ) : null}
                    </div>
                    {group.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 tabular">
                        <Users className="size-3.5" />
                        {group.member_count}
                      </span>
                      {joined.has(group.id) ? (
                        <Badge variant="secondary">Joined</Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
