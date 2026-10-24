import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-[0.9375rem] transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20",
      "placeholder:text-muted-foreground/80",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
