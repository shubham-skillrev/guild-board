'use client'

import type { MeetingState, Segment } from '@/lib/meeting'

/**
 * The seam for Phase 2 (docs/06-meeting-mode.md): the segment's activity on
 * the presenter screen, the poll bars (hidden for the first 8 s) or the word
 * cloud, and later the Boss Round's pass rate. Phase 2 fetches the activity
 * for `segment` from `meeting_activities`, renders it here and adds the
 * presenter's "Open" button; the presenter screen already gives it the
 * space between the segment's heading and Kers' prep.
 *
 * Renders nothing in Phase 1.
 */
export function ActivityPanel(_props: { segment: Segment; state: MeetingState; presenting: boolean }) {
  return null
}
