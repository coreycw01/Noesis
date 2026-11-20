import * as React from "react"

import { cn } from "@/lib/utils"

export type BadgeTone =
  | "neutral" | "ok" | "caution" | "problem" | "info"
  | "stage" | "accent"
  | "source" | "annotation" | "concept" | "inquiry" | "position" | "practice" | "work" | "exercise"

/**
 * Badge: read-only. Says what something is (kind) or how it stands (status).
 * Never pressable; for that use Pill. `shape` picks the drawing: a tinted
 * pill, a dot before plain text, a rule at the left edge, or a bare count.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  shape?: "pill" | "dot" | "rule" | "count"
  icon?: React.ReactNode
  /** Old API, mapped onto tones so existing call sites keep working. */
  variant?: "default" | "secondary" | "destructive" | "outline"
}

const VARIANT_TONE: Record<NonNullable<BadgeProps["variant"]>, BadgeTone> = {
  default: "accent",
  secondary: "neutral",
  destructive: "problem",
  outline: "neutral",
}

function Badge({ className, tone, shape = "pill", icon, variant, children, ...props }: BadgeProps) {
  const resolved = tone ?? (variant ? VARIANT_TONE[variant] : "neutral")
  return (
    <span
      data-tone={resolved}
      className={cn("noesis-badge", shape !== "pill" && `noesis-badge--${shape}`, className)}
      {...props}
    >
      {icon && <span className="noesis-badge__icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}

export { Badge }
