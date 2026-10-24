import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
