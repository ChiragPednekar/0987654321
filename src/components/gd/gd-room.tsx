"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOwnSpeech } from "@/hooks/use-own-speech";
import { cn, formatDuration } from "@/lib/utils";

type Signal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit; from: string; to: string }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit; from: string; to: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; from: string; to: string }
  | { kind: "bye"; from: string };

export interface GdPeerName {
  userId: string;
  name: string;
}

/**
 * A group discussion room: mesh WebRTC video plus a self-transcribing mic.
 *
 * ---------------------------------------------------------------------------
 * Mesh, and why the room is capped at six
 * ---------------------------------------------------------------------------
 * Every participant holds a peer connection to every other, so connections
 * grow as n(n−1)/2 and each browser encodes its camera once per peer. Six is
 * about the limit for an ordinary laptop on home broadband, and it happens to
 * be a realistic GD panel size. Beyond it the honest answer is a media server
 * (an SFU), which is a different piece of infrastructure and a different bill —
 * not a bigger number in this file.
 *
 * ---------------------------------------------------------------------------
 * Glare
 * ---------------------------------------------------------------------------
 * With N peers joining in any order, two browsers can offer each other at the
 * same moment. Rather than implement full perfect negotiation, the room uses
 * the rule that only the peer with the lexicographically smaller id sends the
 * offer. It is deterministic, needs no rollback, and both sides can compute it
 * without talking first.
 */
export function GdRoom({
  sessionId,
  userId,
  names,
  prepSeconds,
  discussionSeconds,
  startedAt,
}: {
  sessionId: string;
  userId: string;
  names: GdPeerName[];
  prepSeconds: number;
  discussionSeconds: number;
  startedAt: string | null;
}) {
  const router = useRouter();
  const localRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const peersRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());

  const [remote, setRemote] = React.useState<Map<string, MediaStream>>(new Map());
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [ending, setEnding] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [transcript, setTranscript] = React.useState<
    { speaker: string; text: string; id: number }[]
  >([]);

  const nameOf = React.useMemo(
    () => new Map(names.map((n) => [n.userId, n.name])),
    [names],
  );

  // ---- phase clock ---------------------------------------------------------
  const begunAt = React.useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : Date.now()),
    [startedAt],
  );

  React.useEffect(() => {
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - begunAt) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [begunAt]);

  const inPrep = elapsed < prepSeconds;
  const remaining = inPrep
    ? prepSeconds - elapsed
    : Math.max(0, prepSeconds + discussionSeconds - elapsed);

  // ---- own-speech transcription -------------------------------------------
  // Only during the discussion. Transcribing the prep phase would put private
  // muttering into the record that everyone in the room can read.
  const postUtterance = React.useCallback(
    (text: string) => {
      setTranscript((t) => [...t, { speaker: "You", text, id: Date.now() + Math.random() }]);
      void fetch(`/api/gd/sessions/${sessionId}/say`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {
        // A dropped line costs a sentence of transcript, not the session.
      });
    },
    [sessionId],
  );

  const { supported: speechSupported } = useOwnSpeech(!inPrep && !ending, postUtterance);

  // ---- mesh ----------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    /**
     * Captured locally rather than read from the ref in cleanup.
     *
     * The ref is what the rest of the component reads, but a cleanup closing
     * over `peersRef.current` would tear down whatever map happened to be
     * there when it ran — not necessarily the one this effect built. With one
     * room per mount they are the same object today; they would stop being so
     * the first time the effect re-ran, and the failure would be leaked peer
     * connections that are hard to notice and harder to trace.
     */
    const peers = peersRef.current;
    const supabase = createClient();
    const channel = supabase.channel(`gd:${sessionId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    const iceServers: RTCIceServer[] = [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    ];
    if (process.env.NEXT_PUBLIC_TURN_URL) {
      iceServers.push({
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      });
    }

    const send = (payload: Signal) =>
      channel.send({ type: "broadcast", event: "signal", payload });

    function connectionFor(peerId: string): RTCPeerConnection {
      const existing = peers.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers });
      peers.set(peerId, pc);

      streamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void send({
            kind: "ice",
            candidate: event.candidate.toJSON(),
            from: userId,
            to: peerId,
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemote((m) => new Map(m).set(peerId, stream));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setRemote((m) => {
            const next = new Map(m);
            next.delete(peerId);
            return next;
          });
        }
      };

      return pc;
    }

    async function offerTo(peerId: string) {
      const pc = connectionFor(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await send({ kind: "offer", sdp: offer, from: userId, to: peerId });
    }

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: true,
        });
      } catch {
        setError(
          "Camera and microphone are needed for a group discussion. Allow access and reload.",
        );
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;

      channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
        const signal = payload as Signal;
        if (signal.from === userId) return;
        if (signal.kind !== "bye" && signal.to !== userId) return;

        if (signal.kind === "bye") {
          peers.get(signal.from)?.close();
          peers.delete(signal.from);
          setRemote((m) => {
            const next = new Map(m);
            next.delete(signal.from);
            return next;
          });
          return;
        }

        const pc = connectionFor(signal.from);
        if (signal.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await send({ kind: "answer", sdp: answer, from: userId, to: signal.from });
        } else if (signal.kind === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.kind === "ice") {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {
            // Candidates can arrive before the remote description; the
            // connection still forms from the ones that land after it.
          }
        }
      });

      // Presence tells us who is already here and who arrives later, which is
      // what a mesh needs and a two-person call does not.
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user: string }>();
        const present = Object.values(state)
          .flat()
          .map((p) => p.user)
          .filter((id) => id && id !== userId);

        for (const peerId of new Set(present)) {
          if (peers.has(peerId)) continue;
          // Glare rule: only the smaller id offers, so two peers never offer
          // each other simultaneously.
          if (userId < peerId) void offerTo(peerId);
          else connectionFor(peerId);
        }
      });

      channel.subscribe(async (state) => {
        if (state !== "SUBSCRIBED" || cancelled) return;
        await channel.track({ user: userId });
      });
    }

    void start();

    return () => {
      cancelled = true;
      void send({ kind: "bye", from: userId });
      peers.forEach((pc) => pc.close());
      peers.clear();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      supabase.removeChannel(channel);
    };
  }, [sessionId, userId]);

  // ---- live transcript from everyone --------------------------------------
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`gd-transcript:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gd_utterances",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; text: string; id: number };
          if (row.user_id === userId) return; // Already shown optimistically.
          setTranscript((t) => [
            ...t,
            { speaker: nameOf.get(row.user_id) ?? "Someone", text: row.text, id: row.id },
          ]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, userId, nameOf]);

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  async function end() {
    setEnding(true);
    try {
      const response = await fetch(`/api/gd/sessions/${sessionId}/end`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not end the discussion.");
        setEnding(false);
        return;
      }
      router.push(`/gd/${sessionId}/result`);
      router.refresh();
    } catch {
      toast.error("Network error.");
      setEnding(false);
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
        <span className="text-sm font-medium">
          {inPrep ? "Preparation — do not speak yet" : "Discussion"}
        </span>
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular",
            !inPrep && remaining < 60 && "text-destructive",
          )}
        >
          {formatDuration(remaining)}
        </span>
      </div>

      {!speechSupported && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              This browser cannot transcribe your speech.
            </span>{" "}
            You can take part, but your contribution cannot be marked. Chrome or
            Edge on a laptop will work. You will be shown as
            &ldquo;not transcribed&rdquo; rather than marked down.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-lg border bg-black">
          <video ref={localRef} autoPlay playsInline muted className="w-full" />
          <span className="absolute bottom-1 left-2 text-[11px] text-white/80">
            You
          </span>
        </div>
        {[...remote.entries()].map(([peerId, stream]) => (
          <RemoteTile key={peerId} stream={stream} name={nameOf.get(peerId) ?? "Participant"} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleMic}>
          {micOn ? <Mic /> : <MicOff />}
          {micOn ? "Mute" : "Unmute"}
        </Button>
        <Button variant="outline" size="sm" onClick={toggleCam}>
          {camOn ? <Video /> : <VideoOff />}
          {camOn ? "Camera off" : "Camera on"}
        </Button>
        <Button variant="destructive" size="sm" onClick={end} disabled={ending}>
          {ending ? <Loader2 className="animate-spin" /> : <PhoneOff />}
          {ending ? "Marking…" : "End and mark"}
        </Button>
      </div>

      <Card>
        <CardContent className="max-h-64 space-y-1.5 overflow-y-auto p-4 text-sm">
          {transcript.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              What everyone says appears here as it is spoken.
            </p>
          ) : (
            transcript.map((line) => (
              <p key={line.id}>
                <span className="font-medium">{line.speaker}:</span>{" "}
                <span className="text-muted-foreground">{line.text}</span>
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RemoteTile({ stream, name }: { stream: MediaStream; name: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative overflow-hidden rounded-lg border bg-black">
      <video ref={ref} autoPlay playsInline className="w-full" />
      <span className="absolute bottom-1 left-2 text-[11px] text-white/80">{name}</span>
    </div>
  );
}
