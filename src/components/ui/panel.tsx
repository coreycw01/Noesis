import * as React from "react"

import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/eyebrow"
import type { BadgeTone } from "@/components/ui/badge"

/**
 * Panel: a sheet on the desk. Cards, instrument frames, section bodies,
 * suggestion cards and pickers are all Panels with a look and a tone.
 */
export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  as?: "div" | "section" | "article" | "aside" | "li" | "button"
  look?: "card" | "dashed" | "tinted" | "plain" | "inset"
  size?: "default" | "lg" | "tight"
  tone?: BadgeTone
  interactive?: boolean
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  headingLevel?: "h2" | "h3" | "h4"
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ as: Tag = "div", look = "card", size = "default", tone, interactive, eyebrow, title, description, actions, headingLevel: Heading = "h3", className, children, ...props }, ref) => {
    const hasHead = eyebrow || title || description || actions
    // The element is chosen at runtime; attribute typing follows the div case.
    const Element = Tag as "div"
    return (
      <Element
        ref={ref}
        data-tone={tone}
        className={cn("noesis-panel", look !== "card" && `noesis-panel--${look}`, size !== "default" && `noesis-panel--${size}`, interactive && "noesis-panel--interactive", className)}
        {...(Tag === "button" ? { type: "button" } : {})}
        {...props}
      >
        {hasHead && (
          <div className="noesis-panel__head">
            <div className="min-w-0">
              {eyebrow && <Eyebrow tone={tone} className="block">{eyebrow}</Eyebrow>}
              {title && <Heading className="noesis-panel__title">{title}</Heading>}
              {description && <p className="noesis-panel__desc">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </Element>
    )
  }
)
Panel.displayName = "Panel"
