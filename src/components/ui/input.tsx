import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-input bg-card px-3.5 py-1 text-[0.9375rem] transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20",
        "placeholder:text-muted-foreground/80",
        // A field that failed validation says so in colour, not only in the
        // message underneath it.
        "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-danger/20",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
