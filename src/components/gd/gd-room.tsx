"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  ImagePlus,
  Loader2,
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
const EMOJIS = ["👏", "👍", "❤️", "😂", "🎉"];

export interface GdPeerName {
  userId: string;
  name: string;
}

/**
 * A lightweight, six-person WebRTC meeting. Camera and mic permission are
 * optional; chat and meeting access do not depend on either device.
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
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

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
        // One side initiates every negotiation to avoid simultaneous offers.
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
          // ICE can arrive before the remote description; later candidates retry the path.
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
      }, 2400);
    });

    channel.on("broadcast", { event: "meeting-ended" }, () => {
      toast("The host ended this meeting.");
      router.push("/gd");
      router.refresh();
    });

    channel.on("broadcast", { event: "chat-refresh" }, () => {
      void loadMessages();
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
          setMediaError("You joined with camera and microphone off. You can turn either on at any time.");
        }
      } else {
        setMediaError("Camera and microphone are unavailable in this browser. You can still join by voice or chat.");
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
  }, [loadMessages, router, sessionId, userId]);

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
      const localStream = streamRef.current;
      setLocalStream(localStream);
      stream.getTracks().forEach((track) => {
        localStream.addTrack(track);
        peersRef.current.forEach((pc) => {
          const transceiver = pc.getTransceivers().find(
            (candidate) => candidate.receiver.track.kind === track.kind,
          );
          if (transceiver) void transceiver.sender.replaceTrack(track);
        });
      });
      if (localRef.current) localRef.current.srcObject = localStream;
      if (kind === "mic") setMicOn(true);
      else setCamOn(true);
    } catch {
      setMediaError(`Could not access your ${kind === "mic" ? "microphone" : "camera"}. Check browser permissions and try again.`);
    } finally {
      setMediaBusy(null);
    }
  }

  async function shareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Meeting link copied.");
      window.setTimeout(() => setCopied(false), 1800);
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
    }, 2400);
    void channelRef.current?.send({
      type: "broadcast",
      event: "reaction",
      payload: { from: userId, emoji },
    });
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
      {isHost && joinPolicy === "approval" && requests.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 font-medium">
              <Users className="size-4" />
              Join requests
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{requests.length}</span>
            </div>
            {requests.map((request) => (
              <div key={request.userId} className="flex items-center justify-between gap-3">
                <span className="text-sm">{request.name}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={decisionBusy === request.userId} onClick={() => void decide(request.userId, "reject")}>
                    <X /> Decline
                  </Button>
                  <Button size="sm" disabled={decisionBusy === request.userId} onClick={() => void decide(request.userId, "approve")}>
                    {decisionBusy === request.userId ? <Loader2 className="animate-spin" /> : <Check />}
                    Admit
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section className="min-w-0 space-y-4">
          <div className="grid min-h-64 gap-3 sm:grid-cols-2">
            {visibleNames.map((person) => (
              <div key={person.id} className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl border bg-black">
                {person.stream && (person.id !== userId || camOn) ? (
                  <PeerVideo stream={person.stream} muted={person.id === userId} />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold">
                    {person.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-3 left-3 rounded bg-black/55 px-2 py-1 text-xs text-white">
                  {person.name}{person.id === userId && !micOn ? " · muted" : ""}
                </span>
                {reactions.filter((reaction) => reaction.from === person.id).slice(-3).map((reaction) => (
                  <span key={reaction.id} className="absolute right-4 top-4 animate-bounce text-3xl drop-shadow">
                    {reaction.emoji}
                  </span>
                ))}
              </div>
            ))}
          </div>

          {mediaError && (
            <p className="text-center text-xs text-muted-foreground">{mediaError}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant={micOn ? "outline" : "secondary"} onClick={() => void enableMedia("mic")} disabled={mediaBusy !== null}>
              {mediaBusy === "mic" ? <Loader2 className="animate-spin" /> : micOn ? <Mic /> : <MicOff />}
              {micOn ? "Mute" : "Turn on mic"}
            </Button>
            <Button variant={camOn ? "outline" : "secondary"} onClick={() => void enableMedia("camera")} disabled={mediaBusy !== null}>
              {mediaBusy === "camera" ? <Loader2 className="animate-spin" /> : camOn ? <Video /> : <VideoOff />}
              {camOn ? "Camera off" : "Turn on camera"}
            </Button>
            <div className="flex items-center gap-1 rounded-md border p-1" aria-label="Send a reaction">
              <Smile className="mx-1 size-4 text-muted-foreground" />
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => react(emoji)} className="rounded px-1.5 py-1 text-lg hover:bg-muted" aria-label={`React ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
            {isHost && (
              <Button variant="outline" onClick={() => void shareLink()}>
                {copied ? <Check /> : <Clipboard />}
                {copied ? "Link copied" : "Share link"}
              </Button>
            )}
            <Button variant={isHost ? "destructive" : "outline"} onClick={() => void leaveOrEnd()} disabled={ending}>
              {ending ? <Loader2 className="animate-spin" /> : isHost ? <PhoneOff /> : <Phone />}
              {ending ? "Leaving…" : isHost ? "End meeting" : "Leave meeting"}
            </Button>
          </div>
          {reactions.filter((reaction) => reaction.from !== userId).length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {reactions.filter((reaction) => reaction.from !== userId).slice(-3).map((reaction) => reaction.emoji).join(" ")}
              {" "}{nameOf.get(reactions.at(-1)?.from ?? "") ?? "Someone"} reacted
            </p>
          )}
        </section>

        <Card className="flex min-h-[440px] min-w-0 flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="font-medium">Meeting chat</h2>
            <span className="ml-auto text-xs text-muted-foreground">{participantIds.size} here</span>
          </div>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Messages and shared photos or videos will appear here.
                </p>
              ) : messages.map((message) => (
                <div key={message.id} className="space-y-1 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{message.user_id === userId ? "You" : message.senderName}</span>
                    <time className="text-[11px] text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </time>
                  </div>
                  {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                  {message.mediaUrl && message.media_kind === "image" && (
                    <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                      {/* User supplied media is served by the private, signed bucket URL. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={message.mediaUrl} alt={message.media_name ?? "Shared image"} className="max-h-56 max-w-full rounded-lg object-contain" />
                    </a>
                  )}
                  {message.mediaUrl && message.media_kind === "video" && (
                    <video src={message.mediaUrl} controls playsInline className="max-h-56 max-w-full rounded-lg" />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {chatError && <p className="px-4 pb-2 text-xs text-destructive">{chatError}</p>}
            <form onSubmit={sendMessage} className="flex items-center gap-2 border-t p-3">
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
              <Button type="button" variant="ghost" size="icon" aria-label="Attach an image or video" disabled={chatBusy} onClick={() => fileRef.current?.click()}>
                <ImagePlus />
              </Button>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                placeholder="Send a message"
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={chatBusy || !draft.trim()}>
                {chatBusy ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </form>
            <p className="px-4 pb-3 text-[11px] text-muted-foreground">Photos and videos up to 25 MB</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PeerVideo({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={cn("h-full max-h-[440px] w-full object-cover")} />;
}
