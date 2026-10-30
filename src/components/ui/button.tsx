import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "touch-target inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground/70 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      /**
       * Apple's button hierarchy (buttons.md › Style): one filled, prominent
       * action per view; a tinted grey for the rest; plain text for the
       * least. Capsules, as on iOS 26 and apple.com. Style, not size, says
       * which choice is preferred.
       */
      variant: {
        default:
          "bg-action text-action-foreground hover:bg-action-hover",
        destructive:
          "bg-danger text-danger-foreground hover:bg-[color-mix(in_srgb,var(--danger)_88%,black)]",
        outline:
          "border border-input bg-card text-foreground hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        // Monochrome: ghost buttons mostly live in bars, and Apple keeps bar
        // controls untinted (toolbars.md). Tinted text is `link`.
        ghost:
          "text-foreground/80 hover:bg-accent hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
        /**
         * Formerly the square black button of the editorial pages. Kept as a
         * name so call sites need not change; it is the prominent action.
         */
        ink:
          "bg-action text-action-foreground hover:bg-action-hover",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3.5 text-[13px]",
        lg: "h-11 px-6 text-base",
        icon: "size-10",
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
