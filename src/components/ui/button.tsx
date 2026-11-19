import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Prototype skin: monospace uppercase pills that take the page's stage color (--accent).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-code text-[10.5px] font-medium uppercase tracking-[0.08em] ring-offset-background transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-accent bg-accent text-background hover:bg-accent/90",
        destructive:
          "border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10",
        outline:
          "border border-accent bg-transparent text-accent hover:bg-accent/15",
        secondary:
          "border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline normal-case tracking-normal font-body text-sm",
      },
      size: {
        default: "h-8 px-3.5",
        sm: "h-7 px-3",
        lg: "h-9 px-5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          size === "icon"
            ? "max-sm:min-h-11 max-sm:min-w-11"
            : "max-sm:min-h-11",
        )}
        ref={ref}
        data-noesis-button=""
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
