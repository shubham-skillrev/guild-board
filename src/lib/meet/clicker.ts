/**
 * The presenter's phone as a clicker (docs/08-meeting-mode-v2.md, Batch 4
 * extras): /meet/present opened on a phone shows a remote instead of the
 * slides. It drives the same server actions as the laptop (goto,
 * open / close / extend activity), so the big screen follows over the
 * meeting channel; both may be open at once and the last action wins.
 *
 * What the remote's buttons do on a slide, by the same rules the laptop and
 * the server use (./slides.ts navBlocked, resultsAfter): while the slide's
 * own activity is open, Back and Next are off and the activity button
 * closes it (moving on to its results slide when that's next).
 *
 * Pure, imports by path only: runs under `node --test`.
 */

import { slideKind, type Segment } from '../meeting.ts'
import { resultsAfter } from './slides.ts'

export type RemoteActivityAction = 'open' | 'close' | 'reopen' | null

export interface RemoteNav {
  /** Index Back goes to, or null when it's off. */
  prev: number | null
  /** Index Next goes to, or null when it's off. */
  next: number | null
  /** The slide's own activity is open: the slide stays put until it's closed. */
  locked: boolean
  /** The activity button: open a ready one, close an open one, reopen a closed one. Null on a slide without its own activity. */
  action: RemoteActivityAction
  /** Closing moves here (its results slide), else it closes in place. */
  closeTo: number | null
}

/**
 * The remote's buttons on slide `idx`. `activity` is the slide's activity as
 * the room shows it (an activity slide's own, a results slide's `of`).
 */
export function remoteNav(
  agenda: Pick<Segment, 'id' | 'slide' | 'of'>[],
  idx: number,
  activity: { segmentId: string; status: 'ready' | 'open' | 'closed' } | null,
): RemoteNav {
  const seg = agenda[idx]
  if (!seg) return { prev: null, next: null, locked: false, action: null, closeTo: null }
  const own = !!activity && activity.segmentId === seg.id && slideKind(seg, true) === 'activity'
  const locked = own && activity!.status === 'open'
  const results = own ? resultsAfter(agenda, seg.id) : null
  const closeTo = results ? agenda.findIndex(s => s.id === results) : -1
  return {
    prev: !locked && idx > 0 ? idx - 1 : null,
    next: !locked && idx < agenda.length - 1 ? idx + 1 : null,
    locked,
    action: !own ? null : activity!.status === 'ready' ? 'open' : activity!.status === 'open' ? 'close' : 'reopen',
    closeTo: closeTo >= 0 ? closeTo : null,
  }
}

/** A phone, or a narrow window: the presenter screen shows the remote there. */
export const REMOTE_QUERY = '(max-width: 640px), (pointer: coarse) and (max-width: 1024px)'
