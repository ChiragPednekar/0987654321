"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  Hand,
  ImagePlus,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Smile,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Signal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit; from: string; to: string }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit; from: string; to: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; from: string; to: string }
  | { kind: "bye"; from: string };

type ChatMessage = {
  id: string;
  user_id: string;
  body: string | null;
  media_kind: "image" | "video" | null;
  media_name: string | null;
  mediaUrl: string | null;
  senderName: string;
  created_at: string;
};

type JoinRequest = { userId: string; name: string };
type Reaction = { id: number; from: string; emoji: string };

const EMOJIS = ["👏", "👍", "❤️", "😂", "🎉", "✋", "💡", "🔥", "😮"];

export interface GdPeerName {
  userId: string;
  name: string;
}

/**
 * A Google Meet-style WebRTC meeting room without proctoring.
 * Supports multi-peer video/audio, live reactions, hand-raising,
 * frictionless link sharing, knock-to-join approval, and media-rich in-meeting chat.
 */
export function GdRoom({
  sessionId,
  userId,
  hostId,
  joinPolicy,
  names,
}: {
  sessionId: string;
  userId: string;
  hostId: string;
  joinPolicy: "open" | "approval";
  names: GdPeerName[];
}) {
  const router = useRouter();
  const localRef = React.useRef<HTMLVideoElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const reactionCounterRef = React.useRef(0);
  const channelRef = React.useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const peersRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatOpenRef = React.useRef(true);

  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [remote, setRemote] = React.useState<Map<string, MediaStream>>(new Map());
  const [micOn, setMicOn] = React.useState(false);
  const [camOn, setCamOn] = React.useState(false);
  const [mediaBusy, setMediaBusy] = React.useState<"mic" | "camera" | null>(null);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [ending, setEnding] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [requests, setRequests] = React.useState<JoinRequest[]>([]);
  const [decisionBusy, setDecisionBusy] = React.useState<string | null>(null);
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [handRaised, setHandRaised] = React.useState(false);
  const [raisedHands, setRaisedHands] = React.useState<Set<string>>(new Set());

  // Chat state
  const [chatOpen, setChatOpen] = React.useState(true);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  const isHost = userId === hostId;
  const nameOf = React.useMemo(
    () => new Map(names.map((person) => [person.userId, person.name])),
    [names],
  );

  const loadMessages = React.useCallback(async () => {
    const response = await fetch(`/api/gd/sessions/${sessionId}/messages`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setMessages(data.messages ?? []);
  }, [sessionId]);

  React.useEffect(() => {
    let cancelled = false;
    const peers = peersRef.current;
    const supabase = createClient();
    const channel = supabase.channel(`gd:${sessionId}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: userId } },
    });
    channelRef.current = channel;

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
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      streamRef.current?.getTracks().forEach((track) => {
        const transceiver = pc.getTransceivers().find(
          (candidate) => candidate.receiver.track.kind === track.kind,
        );
        if (transceiver) void transceiver.sender.replaceTrack(track);
      });
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void send({ kind: "ice", candidate: event.candidate.toJSON(), from: userId, to: peerId });
        }
      };
      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemote((current) => new Map(current).set(peerId, stream));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setRemote((current) => {
            const next = new Map(current);
            next.delete(peerId);
            return next;
          });
        }
      };
      let creatingOffer = false;
      pc.onnegotiationneeded = async () => {
        if (userId >= peerId || creatingOffer || pc.signalingState !== "stable") return;
        creatingOffer = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (pc.localDescription) {
            await send({ kind: "offer", sdp: pc.localDescription, from: userId, to: peerId });
          }
        } catch (error) {
          console.warn("[gd] offer failed", error);
        } finally {
          creatingOffer = false;
        }
      };
      return pc;
    }

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const signal = payload as Signal;
      if (signal.from === userId) return;
      if (signal.kind !== "bye" && signal.to !== userId) return;
      if (signal.kind === "bye") {
        peers.get(signal.from)?.close();
        peers.delete(signal.from);
        setRemote((current) => {
          const next = new Map(current);
          next.delete(signal.from);
          return next;
        });
        return;
      }
      const pc = connectionFor(signal.from);
      if (signal.kind === "offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (pc.localDescription) {
            await send({ kind: "answer", sdp: pc.localDescription, from: userId, to: signal.from });
          }
        } catch (error) {
          console.warn("[gd] offer handling failed", error);
        }
      } else if (signal.kind === "answer" && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.kind === "ice") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch {
          // ICE retries
        }
      }
    });

    channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
      const reaction = payload as { from: string; emoji: string };
      if (!EMOJIS.includes(reaction.emoji)) return;
      const id = Date.now() + Math.random();
      setReactions((current) => [...current, { id, ...reaction }]);
      window.setTimeout(() => {
        setReactions((current) => current.filter((item) => item.id !== id));
      }, 2500);
    });

    channel.on("broadcast", { event: "hand-raise" }, ({ payload }) => {
      const data = payload as { from: string; raised: boolean };
      setRaisedHands((prev) => {
        const next = new Set(prev);
        if (data.raised) next.add(data.from);
        else next.delete(data.from);
        return next;
      });
      if (data.raised && data.from !== userId) {
        const personName = nameOf.get(data.from) ?? "A participant";
        toast(`${personName} raised their hand ✋`);
      }
    });

    channel.on("broadcast", { event: "meeting-ended" }, () => {
      toast("The host ended this meeting.");
      router.push("/gd");
      router.refresh();
    });

    channel.on("broadcast", { event: "chat-refresh" }, () => {
      void loadMessages();
      if (!chatOpenRef.current) {
        setUnreadCount((c) => c + 1);
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ user: string }>();
      const present = Object.values(state).flat().map((person) => person.user)
        .filter((id) => id && id !== userId);
      for (const peerId of new Set(present)) connectionFor(peerId);
    });

    channel.on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "gd_messages",
      filter: `session_id=eq.${sessionId}`,
    }, () => {
      void loadMessages();
      if (!chatOpenRef.current) {
        setUnreadCount((c) => c + 1);
      }
    });

    channel.subscribe(async (state) => {
      if (state !== "SUBSCRIBED" || cancelled) return;
      await channel.track({ user: userId });
      void loadMessages();
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 480, height: 360 },
          });
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          streamRef.current = stream;
          setLocalStream(stream);
          if (localRef.current) localRef.current.srcObject = stream;
          setMicOn(stream.getAudioTracks().some((track) => track.enabled));
          setCamOn(stream.getVideoTracks().some((track) => track.enabled));
          for (const [, pc] of peers) {
            stream.getTracks().forEach((track) => {
              const transceiver = pc.getTransceivers().find(
                (candidate) => candidate.receiver.track.kind === track.kind,
              );
              if (transceiver) void transceiver.sender.replaceTrack(track);
            });
          }
        } catch {
          setMediaError("Joined with camera and microphone off. Click the mic or camera button below to turn either on.");
        }
      } else {
        setMediaError("Camera and microphone are unavailable in this browser. You can still participate in meeting chat.");
      }
    });

    return () => {
      cancelled = true;
      void send({ kind: "bye", from: userId });
      peers.forEach((pc) => pc.close());
      peers.clear();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [loadMessages, nameOf, router, sessionId, userId]);

  React.useEffect(() => {
    if (!isHost || joinPolicy !== "approval") return;
    let active = true;
    async function refreshRequests() {
      const response = await fetch(`/api/gd/sessions/${sessionId}/admission`, { cache: "no-store" });
      if (!active || !response.ok) return;
      const data = await response.json();
      setRequests(data.requests ?? []);
    }
    void refreshRequests();
    const timer = window.setInterval(refreshRequests, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isHost, joinPolicy, sessionId]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function enableMedia(kind: "mic" | "camera") {
    const existing = kind === "mic"
      ? streamRef.current?.getAudioTracks()[0]
      : streamRef.current?.getVideoTracks()[0];
    if (existing) {
      existing.enabled = !existing.enabled;
      if (kind === "mic") setMicOn(existing.enabled);
      else setCamOn(existing.enabled);
      return;
    }
    setMediaBusy(kind);
    setMediaError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Devices unavailable");
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "mic" ? { audio: true, video: false } : { audio: false, video: true },
      );
      if (!streamRef.current) streamRef.current = new MediaStream();
      const local = streamRef.current;
      setLocalStream(local);
      stream.getTracks().forEach((track) => {
        local.addTrack(track);
        peersRef.current.forEach((pc) => {
          const transceiver = pc.getTransceivers().find(
            (candidate) => candidate.receiver.track.kind === track.kind,
          );
          if (transceiver) void transceiver.sender.replaceTrack(track);
        });
      });
      if (localRef.current) localRef.current.srcObject = local;
      if (kind === "mic") setMicOn(true);
      else setCamOn(true);
    } catch {
      setMediaError(`Could not access your ${kind === "mic" ? "microphone" : "camera"}. Please check browser permissions.`);
    } finally {
      setMediaBusy(null);
    }
  }

  async function shareLink() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : `/gd/${sessionId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Meeting link copied! Anyone with the link can join.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Copy it from your browser address bar.");
    }
  }

  async function decide(userIdToDecide: string, decision: "approve" | "reject") {
    setDecisionBusy(userIdToDecide);
    try {
      const response = await fetch(`/api/gd/sessions/${sessionId}/admission`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: userIdToDecide, decision }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not update the request.");
        return;
      }
      setRequests((current) => current.filter((request) => request.userId !== userIdToDecide));
      if (decision === "approve") {
        toast.success("Participant admitted to the meeting.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDecisionBusy(null);
    }
  }

  function react(emoji: string) {
    const id = ++reactionCounterRef.current;
    setReactions((current) => [...current, { id, from: userId, emoji }]);
    window.setTimeout(() => {
      setReactions((current) => current.filter((item) => item.id !== id));
    }, 2500);
    void channelRef.current?.send({
      type: "broadcast",
      event: "reaction",
      payload: { from: userId, emoji },
    });
  }

  function toggleHandRaise() {
    const next = !handRaised;
    setHandRaised(next);
    setRaisedHands((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(userId);
      else copy.delete(userId);
      return copy;
    });
    void channelRef.current?.send({
      type: "broadcast",
      event: "hand-raise",
      payload: { from: userId, raised: next },
    });
    toast(next ? "Hand raised ✋" : "Hand lowered");
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chatBusy) return;
    setChatBusy(true);
    setChatError(null);
    try {
      const response = await fetch(`/api/gd/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message.");
      setDraft("");
      setMessages((current) => current.some((message) => message.id === data.message.id)
        ? current
        : [...current, data.message]);
      void channelRef.current?.send({ type: "broadcast", event: "chat-refresh", payload: {} });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setChatBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (chatBusy) return;
    if (file.size > 25 * 1024 * 1024) {
      setChatError("Files must be 25 MB or smaller.");
      return;
    }
    setChatBusy(true);
    setChatError(null);
    try {
      const signResponse = await fetch(`/api/gd/sessions/${sessionId}/media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }),
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error ?? "Could not prepare the upload.");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("gd-chat-media")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const messageResponse = await fetch(`/api/gd/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaPath: signed.path, mediaName: file.name }),
      });
      const data = await messageResponse.json();
      if (!messageResponse.ok) throw new Error(data.error ?? "Could not share this file.");
      setMessages((current) => current.some((message) => message.id === data.message.id)
        ? current
        : [...current, data.message]);
      void channelRef.current?.send({ type: "broadcast", event: "chat-refresh", payload: {} });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not share this file.");
    } finally {
      setChatBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function leaveOrEnd() {
    setEnding(true);
    try {
      if (isHost) {
        const response = await fetch(`/api/gd/sessions/${sessionId}/end`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error ?? "Could not end the meeting.");
          setEnding(false);
          return;
        }
        void channelRef.current?.send({ type: "broadcast", event: "meeting-ended", payload: {} });
      } else {
        const response = await fetch(`/api/gd/sessions/${sessionId}/leave`, { method: "POST" });
        if (!response.ok) toast.error("Could not update your attendance.");
      }
      router.push("/gd");
      router.refresh();
    } catch {
      toast.error("Network error.");
      setEnding(false);
    }
  }

  const participantIds = new Set([userId, ...remote.keys()]);
  const visibleNames = [...participantIds].map((id) => ({
    id,
    name: id === userId ? "You" : nameOf.get(id) ?? `Participant ${id.slice(0, 5)}`,
    stream: id === userId ? localStream : remote.get(id),
  }));

  return (
    <div className="space-y-4">
      {/* -------------------------------- Top Meet Header Bar --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Meeting Live</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-foreground font-medium">
            <Users className="mr-1 inline size-3.5 text-muted-foreground" />
            {participantIds.size} present
          </span>
          {joinPolicy === "open" ? (
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              Open link
            </span>
          ) : (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-600 dark:text-amber-400">
              Approval required
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={shareLink}
            className="h-8 text-xs"
          >
            {copied ? <Check className="mr-1.5 size-3.5 text-emerald-600" /> : <Link2 className="mr-1.5 size-3.5" />}
            {copied ? "Link copied" : "Share meeting link"}
          </Button>
        </div>
      </div>

      {/* ------------------------- Host Knock / Join Requests Banner --- */}
      {isHost && joinPolicy === "approval" && requests.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10 shadow-sm animate-in fade-in duration-200">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
              <Users className="size-4" />
              Join Requests ({requests.length})
            </div>
            {requests.map((request) => (
              <div key={request.userId} className="flex items-center justify-between gap-3 rounded-md bg-background/80 p-2.5 border border-border">
                <span className="text-sm font-medium">{request.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decisionBusy === request.userId}
                    onClick={() => void decide(request.userId, "reject")}
                    className="h-8 text-xs"
                  >
                    <X className="mr-1 size-3.5" /> Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={decisionBusy === request.userId}
                    onClick={() => void decide(request.userId, "approve")}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {decisionBusy === request.userId ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Check className="mr-1 size-3.5" />}
                    Admit to meeting
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* -------------------------------- Main Room Layout --- */}
      <div className={cn("grid gap-4", chatOpen ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1")}>
        {/* Left: Video Area & Meet Controls */}
        <section className="min-w-0 space-y-4">
          <div className="grid min-h-[380px] gap-3 sm:grid-cols-2">
            {visibleNames.map((person) => {
              const isMe = person.id === userId;
              const isHandRaised = raisedHands.has(person.id);
              const isVideoActive = person.stream && (isMe ? camOn : true);

              return (
                <div
                  key={person.id}
                  className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-zinc-950 text-white shadow-inner"
                >
                  {isVideoActive && person.stream ? (
                    <PeerVideo stream={person.stream} muted={isMe} />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-20 items-center justify-center rounded-full bg-zinc-800 text-2xl font-bold text-zinc-200 border border-zinc-700">
                        {person.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-zinc-400">{person.name}</span>
                    </div>
                  )}

                  {/* Top-Left: Hand Raised Badge */}
                  {isHandRaised && (
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 shadow-md animate-bounce">
                      <span>✋</span>
                      <span>Hand raised</span>
                    </div>
                  )}

                  {/* Bottom-Left: Name & Status Pill */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-md border border-white/10">
                    <span className="font-medium">{person.name}</span>
                    {isMe && !micOn && (
                      <span className="flex items-center text-red-400">
                        <MicOff className="size-3" />
                      </span>
                    )}
                    {person.id === hostId && (
                      <span className="rounded bg-white/20 px-1 py-0.2 text-[11px] text-zinc-200 font-mono">
                        Host
                      </span>
                    )}
                  </div>

                  {/* Floating Reactions on Video Tile */}
                  {reactions
                    .filter((r) => r.from === person.id)
                    .slice(-3)
                    .map((r) => (
                      <span
                        key={r.id}
                        className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 text-4xl animate-bounce drop-shadow-lg"
                      >
                        {r.emoji}
                      </span>
                    ))}
                </div>
              );
            })}
          </div>

          {mediaError && (
            <p className="text-center text-xs text-muted-foreground">{mediaError}</p>
          )}

          {/* ----------------- Google Meet Bottom Floating Toolbar --- */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-border bg-card/90 p-2.5 shadow-md backdrop-blur-md">
            {/* Mic Button */}
            <Button
              variant={micOn ? "outline" : "destructive"}
              size="icon"
              className="size-11 rounded-full"
              onClick={() => void enableMedia("mic")}
              disabled={mediaBusy !== null}
              title={micOn ? "Mute microphone" : "Turn on microphone"}
            >
              {mediaBusy === "mic" ? <Loader2 className="size-5 animate-spin" /> : micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
            </Button>

            {/* Camera Button */}
            <Button
              variant={camOn ? "outline" : "destructive"}
              size="icon"
              className="size-11 rounded-full"
              onClick={() => void enableMedia("camera")}
              disabled={mediaBusy !== null}
              title={camOn ? "Turn off camera" : "Turn on camera"}
            >
              {mediaBusy === "camera" ? <Loader2 className="size-5 animate-spin" /> : camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </Button>

            {/* Hand Raise Toggle */}
            <Button
              variant={handRaised ? "secondary" : "outline"}
              size="icon"
              className={cn("size-11 rounded-full transition-colors", handRaised && "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400")}
              onClick={toggleHandRaise}
              title={handRaised ? "Lower hand" : "Raise hand (✋)"}
            >
              <Hand className="size-5" />
            </Button>

            {/* Quick Reactions Emojis */}
            <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-1">
              <Smile className="mx-1 size-4 text-muted-foreground" />
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  className="rounded-full p-1 text-lg transition-transform hover:scale-125 active:scale-95"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Share Link Button */}
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full"
              onClick={() => void shareLink()}
              title="Copy meeting link to invite others"
            >
              {copied ? <Check className="size-5 text-emerald-600" /> : <Link2 className="size-5" />}
            </Button>

            {/* Toggle Meeting Chat */}
            <Button
              variant={chatOpen ? "secondary" : "outline"}
              size="icon"
              className="relative size-11 rounded-full"
              onClick={() => {
                setChatOpen(!chatOpen);
                if (!chatOpen) setUnreadCount(0);
              }}
              title={chatOpen ? "Hide meeting chat" : "Show meeting chat"}
            >
              <MessageSquare className="size-5" />
              {!chatOpen && unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow">
                  {unreadCount}
                </span>
              )}
            </Button>

            {/* Leave / End Call */}
            <Button
              variant="destructive"
              className="h-11 rounded-full px-5 text-xs font-semibold"
              onClick={() => void leaveOrEnd()}
              disabled={ending}
            >
              {ending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : isHost ? (
                <PhoneOff className="mr-1.5 size-4" />
              ) : (
                <Phone className="mr-1.5 size-4" />
              )}
              {ending ? "Leaving…" : isHost ? "End call" : "Leave call"}
            </Button>
          </div>
        </section>

        {/* Right: Meeting Chat Drawer */}
        {chatOpen && (
          <Card className="flex min-h-[480px] min-w-0 flex-col shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">In-call messages</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setChatOpen(false)}
                title="Close chat"
              >
                <X className="size-4" />
              </Button>
            </div>

            <CardContent className="flex flex-1 flex-col p-0">
              <div className="flex-1 space-y-3.5 overflow-y-auto p-4" aria-live="polite">
                {messages.length === 0 ? (
                  <p className="py-16 text-center text-xs text-muted-foreground">
                    Messages, photos, and videos sent to everyone in the call will appear here.
                  </p>
                ) : (
                  messages.map((message) => {
                    const isMyMessage = message.user_id === userId;
                    return (
                      <div
                        key={message.id}
                        className={cn("flex flex-col space-y-1 text-sm", isMyMessage ? "items-end" : "items-start")}
                      >
                        <div className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {isMyMessage ? "You" : message.senderName}
                          </span>
                          <time>
                            {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </time>
                        </div>

                        {message.body && (
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                              isMyMessage
                                ? "bg-action text-action-foreground"
                                : "bg-muted text-foreground border border-border/60"
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                        )}

                        {message.mediaUrl && message.media_kind === "image" && (
                          <a
                            href={message.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block overflow-hidden rounded-xl border border-border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={message.mediaUrl}
                              alt={message.media_name ?? "Shared image"}
                              className="max-h-56 max-w-full rounded-xl object-contain hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}

                        {message.mediaUrl && message.media_kind === "video" && (
                          <div className="mt-1 overflow-hidden rounded-xl border border-border">
                            <video
                              src={message.mediaUrl}
                              controls
                              playsInline
                              className="max-h-56 max-w-full rounded-xl"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {chatError && <p className="px-4 pb-2 text-xs text-destructive">{chatError}</p>}

              <form onSubmit={sendMessage} className="flex items-center gap-2 border-t p-3 bg-card/40">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-9"
                  aria-label="Attach photo or video"
                  disabled={chatBusy}
                  onClick={() => fileRef.current?.click()}
                  title="Share photo or video (up to 25 MB)"
                >
                  <ImagePlus className="size-4" />
                </Button>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  placeholder="Send a message to everyone"
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0 size-9"
                  aria-label="Send message"
                  disabled={chatBusy || !draft.trim()}
                >
                  {chatBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PeerVideo({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn("h-full max-h-[440px] w-full object-cover rounded-2xl")}
    />
  );
}
