import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Lock, Users } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GroupActions } from "@/components/groups/group-actions";
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
    .select("id, slug, name, description, is_private, member_count, owner_id")
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            {group.is_private ? (
              <Lock className="size-4 text-muted-foreground" aria-label="Private" />
            ) : null}
          </div>
          {group.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          ) : null}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground tabular">
            <Users className="size-3.5" />
            {group.member_count} {group.member_count === 1 ? "member" : "members"}
          </p>
        </div>

        <GroupActions
          groupId={group.id}
          isMember={isMember}
          isOwner={group.owner_id === profile.id}
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
