'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const subscribe = () => () => {}

/**
 * Render floating UI straight into <body>.
 *
 * app/template.tsx wraps every page in a motion.div that animates `scale`, and
 * a transformed ancestor turns `position: fixed` into "fixed to that box", so
 * anything floating inside a page would scroll (or size) with the page. Use
 * this for anything fixed: modals, floating buttons, notes. The bottom nav
 * and meeting pill already portal for the same reason.
 * Nothing renders on the server or during hydration, so the markup matches.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const onClient = useSyncExternalStore(subscribe, () => true, () => false)
  return onClient ? createPortal(children, document.body) : null
}
