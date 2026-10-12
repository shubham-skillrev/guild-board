'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

/**
 * Confirmation for something that cannot be undone. The person types the
 * thing's name (say, "November 2026") before the button unlocks, which turns
 * a reflexive click into a deliberate act.
 */
export function ConfirmDialog({
  title,
  body,
  confirmText,
  actionLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  /** What must be typed to unlock the action. */
  confirmText: string
  actionLabel: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === confirmText.trim().toLowerCase()

  return (
    <Modal title={title} onClose={onClose} className="max-w-md">
      <form
        className="p-5 space-y-4"
        onSubmit={e => { e.preventDefault(); if (matches && !pending) onConfirm() }}
      >
        <p className="text-footnote text-ink-soft leading-relaxed">{body}</p>
        <label className="block">
          <span className="block text-footnote text-ink mb-1.5">
            Type <span className="font-semibold">{confirmText}</span> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={e => setTyped(e.target.value)}
            className="w-full h-10 px-3 bg-sumi border border-border rounded-(--radius-control) text-footnote text-ink focus:outline-none focus:border-vermillion/50"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="secondary"
            className="bg-vermillion text-white hover:bg-vermillion/90 hover:text-white"
            disabled={!matches || pending}
          >
            {pending ? 'Working…' : actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
