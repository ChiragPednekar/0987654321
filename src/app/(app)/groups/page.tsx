import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Globe, Lock, Users } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { JoinGroupModal } from "@/components/groups/join-group-modal";
import { QuickJoinButton } from "@/components/groups/quick-join-button";
import { cleanGroupDescription } from "@/lib/group-codes";

export const metadata: Metadata = {
  title: "Groups",
  description: "Study groups, campus cohorts and interview prep circles on CaseCode.",
};

export default async function GroupsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/groups");

  const supabase = await createClient();

  const [{ data: allGroups }, { data: mine }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, slug, name, description, is_private, member_count, owner_id, join_code")
      .order("member_count", { ascending: false })
      .limit(100),
    supabase.from("group_members").select("group_id").eq("user_id", profile.id),
  ]);

  const joinedIds = new Set((mine ?? []).map((m) => m.group_id));

  // Separate groups into Public groups and My Groups
  const publicGroups = (allGroups ?? []).filter((g) => !g.is_private);
  const myGroups = (allGroups ?? []).filter((g) => joinedIds.has(g.id) || g.owner_id === profile.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Study Groups & Circles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join public practice circles freely or enter a private invite code from your peer or coach.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <JoinGroupModal />
          <CreateGroupForm />
        </div>
      </div>

      {/* My Enrolled Groups */}
      {myGroups.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Users className="size-4 text-primary" />
              My Groups ({myGroups.length})
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {myGroups.map((group) => {
              // The column is the source of truth; older groups may still carry a
  // code embedded in their description.
  const joinCode = group.join_code ?? null;
              const isOwner = group.owner_id === profile.id;
              const cleanDesc = cleanGroupDescription(group.description);

              return (
                <li key={group.id}>
                  <Link href={`/groups/${group.slug}`} className="block h-full">
                    <Card className="h-full border-border/80 transition-colors hover:border-primary/50">
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-foreground">{group.name}</h3>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {group.is_private ? (
                                <Badge variant="outline" className="gap-1 text-xs border-amber-500/30 text-amber-500">
                                  <Lock className="size-3" />
                                  Private
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-xs border-emerald-500/30 text-emerald-500">
                                  <Globe className="size-3" />
                                  Public
                                </Badge>
                              )}
                              {isOwner ? (
                                <Badge variant="secondary" className="text-xs">Owner</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Member</Badge>
                              )}
                            </div>
                          </div>
                          {cleanDesc ? (
                            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                              {cleanDesc}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" />
                            {group.member_count} {group.member_count === 1 ? "member" : "members"}
                          </span>
                          {joinCode ? (
                            <span className="font-mono text-[11px] font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
                              Code: {joinCode}
                            </span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Public Groups (Open to all platform members) */}
      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-emerald-500" />
            <h2 className="text-lg font-semibold tracking-tight">Public Groups</h2>
            <Badge variant="outline" className="text-xs">
              No code required
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visible to all CaseCode members. Join any public group instantly.
          </p>
        </div>

        {publicGroups.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No public groups yet. Click <strong>New group</strong> above to start one!
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {publicGroups.map((group) => {
              const isJoined = joinedIds.has(group.id);
              const cleanDesc = cleanGroupDescription(group.description);

              return (
                <li key={group.id}>
                  <Card className="h-full border-border/80 transition-colors hover:border-primary/50 flex flex-col justify-between">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <Link href={`/groups/${group.slug}`} className="block">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-foreground hover:underline">
                            {group.name}
                          </h3>
                          <Badge variant="outline" className="gap-1 text-xs border-emerald-500/30 text-emerald-500 shrink-0">
                            <Globe className="size-3" />
                            Public
                          </Badge>
                        </div>
                        {cleanDesc ? (
                          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                            {cleanDesc}
                          </p>
                        ) : null}
                      </Link>

                      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" />
                          {group.member_count} {group.member_count === 1 ? "member" : "members"}
                        </span>
                        {isJoined ? (
                          <Badge variant="secondary" className="text-xs">Joined</Badge>
                        ) : (
                          <QuickJoinButton groupId={group.id} groupName={group.name} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
