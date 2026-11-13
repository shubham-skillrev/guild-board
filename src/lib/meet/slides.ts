/**
 * Slides driving their own activities (docs/06-meeting-mode.md, "Slides"):
 * arriving on an activity slide opens its poll, word cloud or Boss Round;
 * leaving it closes it. The server runs this on `goto` (presenter only), the
 * rehearsal runs it locally, so both agree.
 *
 * Pure, imports by path only: runs under `node --test`.
 */

import { slideKind, type Segment } from '../meeting.ts'

export interface ActivityRef {
  id: string
  /** The slide it belongs to (meeting_activities.segment_id). */
  segment_id: string
  status: 'ready' | 'open' | 'closed'
}

export interface GotoPlan {
  /** Close these (open ones that aren't the target's). */
  close: string[]
  /** Open this one (the target activity slide's, while still ready). */
  open: string | null
}

/**
 * What moving the shared screen to `target` does to the activities:
 *
 *   - every open activity closes, except the target slide's own
 *   - an activity slide's activity opens if it has never opened (`ready`).
 *     One that was closed stays closed (coming back to it doesn't reopen it
 *     by accident; the presenter has "Reopen")
 *
 * An old segment counts as an activity slide when it has an activity.
 */
export function gotoPlan(agenda: Pick<Segment, 'id' | 'slide'>[], target: string, activities: ActivityRef[]): GotoPlan {
  const slide = agenda.find(s => s.id === target)
  const own = slide ? activities.find(a => a.segment_id === slide.id) ?? null : null
  const isActivity = !!slide && !!own && slideKind(slide, true) === 'activity'
  const keep = isActivity ? own!.id : null
  return {
    close: activities.filter(a => a.status === 'open' && a.id !== keep).map(a => a.id),
    open: isActivity && own!.status === 'ready' ? own!.id : null,
  }
}

/**
 * The slide "Close voting" moves to: the next slide when it shows this
 * activity's results, else null (close in place).
 */
export function resultsAfter(agenda: Pick<Segment, 'id' | 'slide' | 'of'>[], activitySlide: string): string | null {
  const i = agenda.findIndex(s => s.id === activitySlide)
  const next = i >= 0 ? agenda[i + 1] : undefined
  return next && next.slide === 'results' && next.of === activitySlide ? next.id : null
}

/** Said when the presenter tries to leave an activity slide while its activity is open. */
export const NAV_LOCKED_MESSAGE = 'Close voting to move on.'

/**
 * Whether the presenter may not move from `current` to `target`: while the
 * current slide's own activity is open, the slide stays put (phones would be
 * left on a closed activity otherwise). Only "Close voting"'s own move, to
 * the results slide right after, goes through (moving there closes it).
 * Closing it in place unlocks everything.
 */
export function navBlocked(agenda: Pick<Segment, 'id' | 'slide' | 'of'>[], current: string | null | undefined, target: string, activities: ActivityRef[]): boolean {
  if (!current || current === target) return false
  const own = activities.find(a => a.segment_id === current && a.status === 'open')
  if (!own) return false
  const slide = agenda.find(s => s.id === current)
  if (!slide || slideKind(slide, true) !== 'activity') return false
  return resultsAfter(agenda, current) !== target
}
