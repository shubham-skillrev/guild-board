/** Radar: the meeting's five minutes of "what's new", voted by the guild. */

export const RADAR_LIMITS = { title: 120, note: 160, url: 500, perPerson: 3 } as const

/** How many make the meeting: the top three by votes. */
export const RADAR_TOP = 3

export interface RadarItem {
  kind: 'link' | 'byte'
  id: string
  title: string
  /** Links open the page itself; bytes open their brief. */
  href: string
  /** Where it's from: the link's domain or the byte's publisher. */
  source: string
  note: string | null
  /** Who put a link forward. Bytes come from the digest, so none. */
  by: string | null
  votes: number
  voted: boolean
  mine: boolean
}
