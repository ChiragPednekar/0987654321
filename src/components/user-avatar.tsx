import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarTone, cn, initials, type AvatarTone } from "@/lib/utils";

const TONE: Record<AvatarTone, string> = {
  brand: "bg-brand-surface text-brand border-brand-border",
  info: "bg-info-surface text-info border-info-border",
  success: "bg-success-surface text-success border-success-border",
  highlight: "bg-highlight-surface text-highlight border-highlight-border",
  warning: "bg-warning-surface text-warning border-warning-border",
  danger: "bg-danger-surface text-danger border-danger-border",
};

const SIZE = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-14 text-base",
} as const;

/**
 * A person, everywhere a person is shown: their photo, or their first and
 * last initial on a tint picked from their id. One rule for the top bar, the
 * leaderboard, discussions and Settings, so the same person always looks the
 * same.
 */
export function UserAvatar({
  id,
  name,
  src,
  size = "md",
  className,
}: {
  /** Picks the tint. Where a query has no id to hand, the name stands in. */
  id?: string | null;
  name: string | null | undefined;
  src?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZE[size], className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn("border bg-none font-semibold", TONE[avatarTone(id ?? name)])}>
        <span aria-hidden>{initials(name)}</span>
        <span className="sr-only">{name ?? "Unknown user"}</span>
      </AvatarFallback>
    </Avatar>
  );
}
