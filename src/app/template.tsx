'use client'

import type { ReactNode } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  /* Same markup on the server and the client, always. This used to return a
     bare fragment when reduced motion was on, but the server cannot know that
     preference, so every page failed hydration for those visitors. Framer's
     `reducedMotion="user"` drops the transform and keeps the fade instead. */
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        initial={{ opacity: 0.97, scale: 0.997 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        // Not `transform`: will-change: transform makes this div the containing
        // block for every position: fixed element inside a page, which broke
        // modals and floating buttons on scrolled pages. Framer clears the
        // transform once the scale settles at 1.
        style={{ willChange: 'opacity' }}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}
