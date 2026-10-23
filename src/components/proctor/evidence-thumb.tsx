import { timeAgo } from "@/lib/utils";

/** Said plainly — the reader is deciding something about a student. */
export const EVIDENCE_LABEL: Record<string, string> = {
  phone: "phone",
  multiple_faces: "another person",
  no_face: "nobody in frame",
  book: "book",
  looking_away: "looking away",
  voice_detected: "voice heard",
  voice_audio: "voice recording",
  too_dark: "too dark to see",
};

/**
 * One piece of proctor evidence: a camera photo, or the short recording taken
 * when a voice was heard. Shared by the integrity page, the teacher's review
 * queue and the lockout list, so all three say the same thing about it.
 *
 * Plain img and audio, not next/image: these are short-lived signed URLs to a
 * private bucket, and the image optimiser would cache a private photo under a
 * public URL.
 */
export function EvidenceThumb({ photo }: { photo: { kind: string; takenAt: string; url: string } }) {
  const label = EVIDENCE_LABEL[photo.kind] ?? photo.kind;
  const caption = (
    <span className="block px-1.5 py-1 text-[10px] text-muted-foreground group-hover:text-foreground">
      {label} · {timeAgo(photo.takenAt)}
    </span>
  );

  if (photo.kind === "voice_audio") {
    return (
      <div className="group block w-48 overflow-hidden rounded-md border">
        <audio controls preload="none" src={photo.url} className="h-9 w-full" aria-label={`Recording: ${label}`} />
        {caption}
      </div>
    );
  }

  return (
    <a href={photo.url} target="_blank" rel="noreferrer" className="group block w-28 overflow-hidden rounded-md border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={`Camera photo: ${label}`} className="aspect-[4/3] w-full bg-muted object-cover" loading="lazy" />
      {caption}
    </a>
  );
}
