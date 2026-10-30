import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      /**
       * Each status reads as its own hue at a glance: surface fill, matching
       * hairline, solid text. The hairline is what stops a row of badges
       * dissolving into the card behind them.
       */
      variant: {
        default: "bg-brand-surface text-brand",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "bg-success-surface text-success",
        warning: "bg-warning-surface text-warning",
        destructive: "bg-danger-surface text-danger",
        info: "bg-info-surface text-info",
        highlight: "bg-highlight-surface text-highlight",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** A span, so a badge can sit inside a line of text (a name, a title) without breaking the HTML. */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
