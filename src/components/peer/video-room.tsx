"use client";

import * as React from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Signal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit; from: string }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit; from: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { kind: "bye"; from: string };

type Status = "idle" | "connecting" | "live" | "failed" | "ended";

/**
 * One-to-one video for a peer interview.
 *
 * WebRTC peer-to-peer, with Supabase Realtime carrying the signalling. Vercel's
 * functions cannot hold a WebSocket open, so a self-hosted signalling server was
 * never an option here; Realtime is already part of the stack and its broadcast
 * channel is exactly the short-lived message bus this needs.
 *
 * The media itself never touches a server: once the two browsers have exchanged
 * descriptions they talk directly. That keeps cost flat no matter how many
 * sessions run at once, and means no recording exists anywhere by default.
 *
 * The known limit is NAT. Google's public STUN resolves most home and mobile
 * networks; a minority of campus and corporate networks are strict enough to
 * need a TURN relay, which has to be paid for because it carries the media.
 * Set NEXT_PUBLIC_TURN_URL / _USERNAME / _CREDENTIAL and those calls connect
 * too — without it they fail honestly rather than hanging, which is what the
 * `failed` status is for.
 */
export function VideoRoom({
  sessionId,
  userId,
  onEnd,
}: {
  sessionId: string;
  userId: string;
  onEnd?: () => void;
}) {
  const localRef = React.useRef<HTMLVideoElement>(null);
  const remoteRef = React.useRef<HTMLVideoElement>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [status, setStatus] = React.useState<Status>("idle");
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const channel = supabase.channel(`peer:${sessionId}`, {
      config: { broadcast: { self: false } },
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

    async function start() {
      setStatus("connecting");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        // Denied or no device. Say so plainly — a black rectangle with no
        // explanation is the worst possible version of this.
        if (!cancelled) {
          setError("CaseCode needs camera and microphone access to run the interview.");
          setStatus("failed");
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteRef.current) remoteRef.current.srcObject = event.streams[0];
        setStatus("live");
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void send({ kind: "ice", candidate: event.candidate.toJSON(), from: userId });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          setError(
            "Could not open a direct connection. This usually means a restrictive network — try a different one, or a mobile hotspot.",
          );
          setStatus("failed");
        }
        if (pc.connectionState === "disconnected") setStatus("connecting");
      };

      channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
        const signal = payload as Signal;
        if (signal.from === userId) return;

        if (signal.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          void send({ kind: "answer", sdp: answer, from: userId });
        } else if (signal.kind === "answer") {
          if (pc.signalingState !== "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.kind === "ice") {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {
            // A candidate arriving before the remote description is normal.
          }
        } else if (signal.kind === "bye") {
          setStatus("ended");
          onEnd?.();
        }
      });

      channel.subscribe(async (state) => {
        if (state !== "SUBSCRIBED") return;

        /**
         * Both sides run this component, so both would offer at once and
         * glare. The lower user id yields and waits: a deterministic rule that
         * needs no extra round trip to agree on.
         */
        const presence = await channel.track({ user: userId });
        if (presence !== "ok") return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void send({ kind: "offer", sdp: offer, from: userId });
      });
    }

    void start();

    return () => {
      cancelled = true;
      void channel.send({ type: "broadcast", event: "signal", payload: { kind: "bye", from: userId } });
      supabase.removeChannel(channel);
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [sessionId, userId, onEnd]);

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

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="aspect-video w-full bg-black object-cover"
        />

        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-6 text-center">
            <p className="text-sm text-white">
              {status === "connecting" && "Connecting to your partner…"}
              {status === "idle" && "Starting camera…"}
              {status === "ended" && "Your partner left the room."}
              {status === "failed" && "Could not connect."}
            </p>
            {error && <p className="max-w-sm text-xs text-white/70">{error}</p>}
          </div>
        )}

        {/* Own camera, small, mirrored — the convention everywhere else. */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-3 right-3 w-32 rounded-md border border-white/20 bg-black object-cover shadow-lg sm:w-40"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={micOn ? "outline" : "destructive"}
          size="icon"
          onClick={toggleMic}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </Button>
        <Button
          variant={camOn ? "outline" : "destructive"}
          size="icon"
          onClick={toggleCam}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
        >
          {camOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
        </Button>
        <Button variant="destructive" onClick={() => onEnd?.()}>
          <PhoneOff className="size-4" />
          Leave
        </Button>
        <span
          className={cn(
            "ml-2 text-xs",
            status === "live" ? "text-[var(--success)]" : "text-muted-foreground",
          )}
        >
          {status === "live" ? "Connected" : status}
        </span>
      </div>
    </div>
  );
}
