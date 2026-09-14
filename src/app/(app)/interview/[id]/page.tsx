import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PiChat } from "@/components/pi/pi-chat";
import { PI_KINDS, PI_MAX_QUESTIONS } from "@/lib/pi";

export const metadata: Metadata = { title: "Interview" };

export default async function PiSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/interview/${id}`);

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("pi_sessions")
    .select("id, user_id, kind, status, target_firm")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) notFound();
  if (session.status === "completed") redirect(`/interview/${id}/result`);

  const { data: messages } = await admin
    .from("pi_messages")
    .select("role, content")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const turns = (messages ?? []).map((m) => ({ role: m.role, content: m.content }));
  const asked = turns.filter((t) => t.role === "interviewer").length;
  const kind = PI_KINDS.find((k) => k.value === session.kind);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Round
          </p>
          <p className="mt-0.5 font-medium">
            {kind?.label ?? session.kind}
            {session.target_firm ? ` · ${session.target_firm}` : ""}
          </p>
        </CardContent>
      </Card>

      <div className="mt-4">
        <PiChat
          sessionId={id}
          initial={turns}
          questionsAsked={asked}
          maxQuestions={PI_MAX_QUESTIONS}
        />
      </div>
    </div>
  );
}
