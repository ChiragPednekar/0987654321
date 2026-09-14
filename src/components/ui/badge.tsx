import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      /**
       * Each status reads as its own hue at a glance: surface fill, matching
       * hairline, solid text. The hairline is what stops a row of badges
       * dissolving into the card behind them.
       */
      variant: {
        default: "border-brand-border bg-brand-surface text-brand",
        secondary: "border-border-subtle bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-success-border bg-success-surface text-success",
        warning: "border-warning-border bg-warning-surface text-warning",
        destructive: "border-danger-border bg-danger-surface text-danger",
        info: "border-info-border bg-info-surface text-info",
        highlight: "border-highlight-border bg-highlight-surface text-highlight",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
