import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import type { BadgeTone } from "@/components/ui/badge"

/**
 * The button hierarchy. One primary per view; secondary for the other real
 * actions; tertiary for quiet in-text actions; destructive only for deleting;
 * ghost for icon-only chrome. Older names (default, outline) still work and
 * map onto the hierarchy so nothing breaks while pages move over.
 *
 * Buttons take the page's stage colour through --accent, or an explicit tone
 * through data-tone="ok|caution|problem|…".
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--button-radius)] font-body text-sm leading-none ring-offset-background transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border border-tone bg-tone text-background hover:bg-tone/88",
        secondary: "border border-tone/70 bg-transparent text-tone hover:bg-tone/12",
        tertiary: "border border-transparent bg-transparent text-foreground underline decoration-border underline-offset-4 hover:decoration-current",
        destructive: "border border-problem/55 bg-transparent text-problem hover:bg-problem/10",
        ghost: "border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "h-auto min-h-0 border-0 p-0 text-tone underline-offset-4 hover:underline",
        // Aliases kept for existing call sites.
        default: "border border-tone bg-tone text-background hover:bg-tone/88",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted/70",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-5 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
      voice: {
        mono: "font-code text-[10.5px] font-medium uppercase tracking-[0.08em]",
        text: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      voice: "text",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Semantic tone instead of the page's stage colour. */
  tone?: BadgeTone
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, voice, tone, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const iconOnly = size === "icon" || size === "icon-sm"
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, voice, className }),
          iconOnly ? "max-sm:min-h-11 max-sm:min-w-11" : variant === "link" ? "" : "max-sm:min-h-11",
        )}
        ref={ref}
        data-noesis-button=""
        data-tone={tone}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

/** Icon-only button. Always has an accessible name. */
const IconButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "size" | "children"> & { label: string; size?: "default" | "sm"; children: React.ReactNode }>(
  ({ label, size = "default", variant = "ghost", children, ...props }, ref) => (
    <Button ref={ref} variant={variant} size={size === "sm" ? "icon-sm" : "icon"} aria-label={label} title={label} {...props}>
      {children}
    </Button>
  )
)
IconButton.displayName = "IconButton"

export { Button, IconButton, buttonVariants }
