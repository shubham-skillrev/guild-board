'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Modal } from '@/components/ui/Modal'
import { Portal } from '@/components/ui/Portal'

/**
 * Stops a guest at the click, before any request.
 *
 * The proxy refuses guest writes with a 403 either way. Left to that, every
 * control failed its own way: some reverted a count with a toast that was
 * easy to miss, some swallowed the error and did nothing at all, and a reply
 * just sat in its box. Every write handler now asks `blockGuest()` first, and
 * a guest gets the same answer everywhere: a dialog saying why, with the way
 * to sign in.
 */
const GuestGateCtx = createContext<{ isGuest: boolean; blockGuest: () => boolean }>({
  isGuest: false,
  blockGuest: () => false,
})

export function GuestGateProvider({ isGuest, children }: { isGuest: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  // True means "stop here": the caller returns without doing anything.
  const blockGuest = useCallback(() => {
    if (!isGuest) return false
    setOpen(true)
    return true
  }, [isGuest])

  const value = useMemo(() => ({ isGuest, blockGuest }), [isGuest, blockGuest])

  return (
    <GuestGateCtx.Provider value={value}>
      {children}
      <Portal>
        <AnimatePresence>
          {open && (
            <Modal title="Sign in to take part" onClose={close} className="max-w-sm">
              <div className="p-5 space-y-4">
                <p className="text-[14px] text-ink-soft">
                  Guest mode is read-only. Votes, reactions and replies need a
                  @skillrev.dev account.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {/* The OAuth callback clears the guest cookie on the way back. */}
                  <Link
                    href="/login"
                    onClick={close}
                    className="press inline-flex items-center h-9 px-4 rounded-full bg-ink text-parchment text-[13px] font-medium hover:bg-ink/85 transition-colors"
                  >
                    Sign in
                  </Link>
                  <button
                    type="button"
                    onClick={close}
                    className="press inline-flex items-center h-9 px-4 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink hover:bg-kinu/50 transition-colors"
                  >
                    Keep looking
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </Portal>
    </GuestGateCtx.Provider>
  )
}

export function useGuestGate() {
  return useContext(GuestGateCtx)
}
