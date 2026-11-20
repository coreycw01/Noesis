import * as React from "react"

import { cn } from "@/lib/utils"
import type { BadgeTone } from "@/components/ui/badge"

/**
 * Eyebrow: the one small-caps label, for section names, field names and
 * kickers. Replaces the dozen font-code/uppercase/tracking recipes.
 */
export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  as?: "span" | "div" | "h2" | "h3" | "h4" | "label" | "legend" | "p"
  size?: "sm" | "md"
  tone?: BadgeTone
  strong?: boolean
  htmlFor?: string
}

export function Eyebrow({ as: Tag = "span", size = "md", tone, strong, className, ...props }: EyebrowProps) {
  return (
    <Tag
      data-tone={tone}
      className={cn("noesis-eyebrow", size === "sm" && "noesis-eyebrow--sm", tone && "noesis-eyebrow--tone", strong && "noesis-eyebrow--strong", className)}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  )
}
