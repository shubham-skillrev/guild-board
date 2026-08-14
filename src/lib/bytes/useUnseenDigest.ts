'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * "There is a digest you have not opened yet."
 *
 * A push notification only reaches the members who granted permission, and on
 * iOS that means the ones who installed the PWA first. Everyone else had no way
 * of knowing a new week had landed, so the digest depended entirely on someone
 * remembering to check. This is the in-app half of the same announcement: a dot
 * in the nav that clears the moment the page is opened.
 *
 * Deliberately localStorage rather than a `bytes_reads` table. "Have I seen
 * this" is per-device, worth nothing to anyone else, and not worth a migration,
 * a write on every page view, or a row per member per week.
 */
const KEY = 'bytes:last-seen-digest'

interface LatestDigest {
  id: string
  label: string
  published_at: string | null
}

export function useUnseenDigest() {
  const [latest, setLatest] = useState<LatestDigest | null>(null)
  const [seenId, setSeenId] = useState<string | null>(null)

  useEffect(() => {
    // Reading localStorage during render would mismatch the server HTML, so
    // both halves land after mount and `unseen` is simply false until then.
    try {
      setSeenId(window.localStorage.getItem(KEY))
    } catch {
      /* Safari private mode. No dot is better than a crash. */
    }

    let cancelled = false
    fetch('/api/bytes/latest')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data?.digest) setLatest(data.digest as LatestDigest)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const markSeen = useCallback((digestId: string) => {
    setSeenId(digestId)
    try {
      window.localStorage.setItem(KEY, digestId)
    } catch {
      /* see above */
    }
  }, [])

  return {
    latest,
    /* A member who has never opened Bytes gets the dot on their first digest,
       which is the correct introduction to a page they have not found yet. */
    unseen: !!latest && latest.id !== seenId,
    markSeen,
  }
}
