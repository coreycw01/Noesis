import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { BadgeTone } from "@/components/ui/badge"

/**
 * Pill: pressable. A filter, a toggle, a choice, or a removable selection.
 * Pressed state comes from aria-pressed / aria-selected / aria-current so the
 * look and the semantics cannot drift apart.
 */
export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  tone?: BadgeTone
  look?: "text" | "mono" | "italic"
  size?: "default" | "lg"
  /** Show a × that calls this, for selected items that can be taken away. */
  onRemove?: () => void
  removeLabel?: string
}

const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  ({ className, pressed, tone, look = "text", size = "default", onRemove, removeLabel = "Remove", children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed === undefined ? undefined : pressed}
      data-tone={tone}
      className={cn("noesis-pill", tone && "noesis-pill--tone", look !== "text" && `noesis-pill--${look}`, size === "lg" && "noesis-pill--lg", className)}
      {...props}
    >
      {children}
      {onRemove && (
        <span role="button" tabIndex={0} aria-label={removeLabel} className="noesis-pill__remove"
          onClick={(event) => { event.stopPropagation(); onRemove() }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onRemove() } }}>
          <X className="size-3" aria-hidden="true" />
        </span>
      )}
    </button>
  )
)
Pill.displayName = "Pill"

/** A row of pills that wraps. */
function PillRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap gap-1.5", className)} {...props} />
}

export { Pill, PillRow }
