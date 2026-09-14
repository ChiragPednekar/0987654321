import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
  {
    variants: {
      variant: {
        default:
          "bg-action text-action-foreground shadow-xs hover:bg-action-hover",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground hover:border-[color-mix(in_oklch,var(--input)_70%,var(--foreground))] hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground/85 hover:bg-accent hover:text-foreground",
        link: "text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary",
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
