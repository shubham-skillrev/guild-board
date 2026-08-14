'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

interface ModalProps {
  title: string
  /** Small line under the title — cycle label, context, etc. */
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Dialog shell extracted from SubmitModal, plus the two things that version
 * lacks: Escape-to-close and a body scroll lock while open.
 */
export function Modal({ title, subtitle, onClose, children, className }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'bg-paper border border-border-strong rounded-xl shadow-2xl w-full max-w-lg mx-4',
          'max-h-[90vh] overflow-y-auto animate-fade-up',
          className,
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-[11px] text-cha mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-cha hover:text-ink transition-colors p-1 rounded-md hover:bg-kinu shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
