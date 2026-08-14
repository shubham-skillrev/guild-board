'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * Modal surface. Replaces the old Modal.
 *
 * Bottom sheet on a phone, centred dialog on desktop. That is not decoration:
 * a sheet anchored to the bottom edge is reachable with a thumb, where a
 * centred dialog on a tall phone puts its controls in the dead zone.
 *
 * It materializes rather than fades. Scale, position and opacity move together
 * on a critically damped spring so the surface reads as arriving, and it exits
 * along the same path it entered.
 */

interface SheetProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Sheet({ title, subtitle, onClose, children, className }: SheetProps) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <motion.div
      // A blocking task, so it gets a scrim that pushes the page back.
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className={cn(
          'material-raised w-full sm:max-w-lg max-h-[92vh] overflow-y-auto',
          // Rounded only at the top on mobile: it is anchored to the screen edge.
          'rounded-t-[20px] sm:rounded-[20px] sm:mx-4',
          'pb-[env(safe-area-inset-bottom)] sm:pb-0',
          className,
        )}
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }
        }
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      >
        {/* Grab handle. Purely a mobile affordance, so it hides on desktop. */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden>
          <div className="h-1 w-9 rounded-full bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-3 px-(--pad-card) py-3.5 border-b border-separator">
          <div className="min-w-0">
            <h2 className="text-title-3 text-label">{title}</h2>
            {subtitle && <p className="text-footnote text-label-3 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press-sm shrink-0 rounded-lg p-1.5 text-label-3 hover:text-label hover:bg-fill transition-colors"
          >
            <Icon icon={X} size="lg" />
          </button>
        </div>

        {children}
      </motion.div>
    </motion.div>
  )
}
