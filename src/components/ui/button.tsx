import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:border-border-subtle disabled:bg-muted disabled:text-muted-foreground/60 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
  {
    variants: {
      /**
       * Five tiers that are told apart by weight, not only by hue: a filled
       * brand primary, a tinted-neutral secondary that carries a hairline, a
       * bordered tertiary on card, a borderless ghost, and a filled danger.
       * Every one has its own hover AND active state, so a press is visible
       * on a trackpad where hover never lands.
       */
      variant: {
        default:
          "bg-action text-action-foreground shadow-xs hover:bg-action-hover active:bg-[color-mix(in_oklch,var(--action-hover)_88%,black)]",
        destructive:
          "bg-danger text-danger-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--danger)_90%,black)] active:bg-[color-mix(in_oklch,var(--danger)_80%,black)]",
        outline:
          "border border-input bg-card text-foreground hover:border-brand-border hover:bg-brand-surface hover:text-brand active:bg-[color-mix(in_oklch,var(--brand-surface)_88%,var(--brand))]",
        secondary:
          // Hairline drawn as an inset shadow, not a border: a real border
          // would add 2px to the button's width and move everything beside it.
          "bg-secondary text-secondary-foreground shadow-[inset_0_0_0_1px_var(--border-subtle)] hover:bg-accent hover:shadow-[inset_0_0_0_1px_var(--border)] active:bg-[color-mix(in_oklch,var(--accent)_90%,var(--foreground))]",
        ghost:
          "text-muted-foreground hover:bg-brand-surface hover:text-brand active:bg-[color-mix(in_oklch,var(--brand-surface)_88%,var(--brand))]",
        link: "text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
