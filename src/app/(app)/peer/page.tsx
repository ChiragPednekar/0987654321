import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Video } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { canSolve } from "@/lib/entitlement";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpenRoomForm } from "@/components/peer/open-room-form";
import { LicenceGate } from "@/components/case/licence-gate";
import { DOMAIN_LABEL } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import type { Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Peer interviews" };
export const dynamic = "force-dynamic";

/**
 * The lobby.
 *
 * A case interview has two sides and the platform only ever had one: write an
 * answer, have a model mark it. Nobody had to ask the follow-up, sit through
 * the silence, or defend a number out loud — which is most of the real thing.
 */
export default async function PeerLobbyPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/peer");

  const admin = createAdminClient();
  const entitled = await canSolve(admin, profile.id);

  const [{ data: open }, { data: mine }] = await Promise.all([
    admin
      .from("peer_sessions")
      .select("id, case_id, host_id, host_role, created_at, cases(title, domain, difficulty, estimated_minutes), users!peer_sessions_host_id_fkey(full_name)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("peer_sessions")
      .select("id, status, host_id, guest_id, created_at, cases(title)")
      .or(`host_id.eq.${profile.id},guest_id.eq.${profile.id}`)
      .in("status", ["open", "live"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const rooms = (open ?? []).filter((r) => r.host_id !== profile.id);
  const own = mine ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Peer interviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Take a case with another student. One interviews, one answers, then you
        swap — and you each mark the other on the same rubric the AI uses.
      </p>

      {!entitled ? (
        <div className="mt-6">
          <LicenceGate />
        </div>
      ) : (
        <>
          {own.length > 0 && (
            <Card className="mt-6 border-primary/40">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Your rooms
                </p>
                <ul className="mt-2 space-y-2">
                  {own.map((room) => {
                    const c = Array.isArray(room.cases) ? room.cases[0] : room.cases;
                    return (
                      <li key={room.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm">
                          {c?.title ?? "Case"}{" "}
                          <Badge variant="outline" className="ml-1">{room.status}</Badge>
                        </span>
                        <Button size="sm" asChild>
                          <Link href={`/peer/${room.id}`}>
                            {room.status === "live" ? "Rejoin" : "Open room"}
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="mt-6">
            <OpenRoomForm />
          </div>

          <h2 className="mt-8 text-sm font-medium">
            Waiting for a partner{" "}
            <span className="text-muted-foreground">({rooms.length})</span>
          </h2>

          {rooms.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="p-8 text-center">
                <Users className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Nobody is waiting right now. Open a room and it will appear here
                  for other students to join.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="mt-3 space-y-2">
              {rooms.map((room) => {
                const c = Array.isArray(room.cases) ? room.cases[0] : room.cases;
                const host = Array.isArray(room.users) ? room.users[0] : room.users;
                return (
                  <li key={room.id}>
                    <Card>
                      <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <Video className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {c?.title ?? "Case"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {host?.full_name ?? "A student"} wants to{" "}
                            <strong>
                              {room.host_role === "interviewer" ? "interview" : "be interviewed"}
                            </strong>{" "}
                            · opened {timeAgo(room.created_at)}
                          </p>
                        </div>
                        {c?.domain && (
                          <Badge variant="outline">
                            {DOMAIN_LABEL[c.domain as Domain] ?? c.domain}
                          </Badge>
                        )}
                        <Button size="sm" asChild>
                          <Link href={`/peer/${room.id}`}>
                            Join as {room.host_role === "interviewer" ? "candidate" : "interviewer"}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
