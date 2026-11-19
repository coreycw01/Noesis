import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Prototype skin: monospace pill tags, tinted by their color (default: muted ink).
const badgeVariants = cva(
  "noesis-tag inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-code text-[10px] uppercase leading-4 tracking-[0.06em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-accent/35 bg-accent/12 text-accent",
        secondary: "border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
        destructive: "border-destructive/35 bg-destructive/12 text-destructive",
        outline: "border-muted-foreground/35 bg-muted-foreground/10 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
