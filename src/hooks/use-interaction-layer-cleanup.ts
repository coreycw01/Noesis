"use client"

import * as React from "react"

import { releaseStaleModalInteractionLock } from "@/lib/modal-interaction"

export function useInteractionLayerCleanup(
  open: boolean | undefined,
  onOpenChange?: (open: boolean) => void,
) {
  React.useEffect(() => {
    if (open === false) releaseStaleModalInteractionLock()
  }, [open])

  return React.useCallback((nextOpen: boolean) => {
    onOpenChange?.(nextOpen)
    if (!nextOpen) releaseStaleModalInteractionLock()
  }, [onOpenChange])
}
