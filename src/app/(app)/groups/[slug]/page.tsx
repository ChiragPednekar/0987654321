import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Globe, Lock, Users } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GroupActions } from "@/components/groups/group-actions";
import { GroupCodeBadge } from "@/components/groups/group-code-badge";
import { cleanGroupDescription } from "@/lib/group-codes";
import { initials, timeAgo } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return { title: "Group not found" };
  return { title: data.name, description: data.description ?? undefined };
}

export default async function GroupPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/groups/${slug}`);

  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, slug, name, description, is_private, member_count, owner_id, join_code")
    .eq("slug", slug)
    .maybeSingle();

  // A private group the viewer is not in is filtered out by RLS, so this is
  // indistinguishable from a group that does not exist — which is the point.
  if (!group) notFound();

  const [{ data: membership }, { data: posts }] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", group.id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("group_posts")
      .select("id, body, upvotes, created_at, users(full_name)")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const isMember = Boolean(membership);
  const isOwner = group.owner_id === profile.id;
  // The column is the source of truth; older groups may still carry a
  // code embedded in their description.
  const joinCode = group.join_code ?? null;
  const cleanDesc = cleanGroupDescription(group.description);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
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
          </div>
          {cleanDesc ? (
            <p className="mt-1 text-sm text-muted-foreground">{cleanDesc}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 tabular">
              <Users className="size-3.5" />
              {group.member_count} {group.member_count === 1 ? "member" : "members"}
            </span>
            {group.is_private && joinCode && (isMember || isOwner) ? (
              <GroupCodeBadge code={joinCode} isOwner={isOwner} />
            ) : null}
          </div>
        </div>

        <GroupActions
          groupId={group.id}
          isMember={isMember}
          isOwner={isOwner}
          isPrivate={group.is_private}
        />
      </div>

      <div className="mt-8 space-y-4">
        {!posts || posts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nothing posted yet.
              {isMember ? " Start the conversation." : " Join to post."}
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => {
            const author = Array.isArray(post.users) ? post.users[0] : post.users;
            return (
              <Card key={post.id}>
                <CardContent className="flex gap-3 p-4">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback>{initials(author?.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {author?.full_name ?? "Anonymous"}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(post.created_at)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{post.body}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
