/**
 * Kers's poses, as rigs for his SVG (components/kers/Kers.tsx). He's a
 * chubby little cursor with short stick limbs: thin lines ending in round
 * hands and feet. Everything is drawn in a 200 x 240 box with the ground at
 * y 228.
 *
 * Shoulders and hips are in body coordinates (they move with him when he
 * sits, `dy`); hands are in body coordinates too; feet are on the ground.
 */
export type KersPose =
  | 'standing' | 'sitting' | 'walk-a' | 'walk-b' | 'arms-up' | 'waving' | 'asleep'
  // His day: at the laptop, coffee, a book, meditating, brushing his teeth.
  | 'laptop' | 'mug' | 'reading' | 'meditating' | 'brushing'
  // Woken at night: sitting up, rubbing an eye.
  | 'rubbing'
  // At his desk (the desk hides his lower half): typing, a mug, chopsticks, a book, arms crossed in a sulk, asleep head-down, woken.
  | 'desk-typing' | 'desk-mug' | 'desk-lunch' | 'desk-reading' | 'desk-sulk' | 'desk-asleep' | 'desk-rubbing'

export type Point = [number, number]

export interface Rig {
  /** Body moved down (sitting). */
  dy: number
  /** Asleep: slumped over under a blanket, eyes shut. */
  lying?: boolean
  /** Where his hands end up (body coordinates). */
  hands: [Point, Point]
  /** Where his feet are (on the ground). */
  feet: [Point, Point]
  /** Arms in front of his body (holding things) rather than at his sides. */
  front?: boolean
  prop?: 'laptop' | 'mug' | 'book' | 'cushion' | 'toothbrush' | 'blanket'
  /** The arm that waves. */
  wave?: 'left' | 'right'
  /** Whole-body tilt in degrees (clockwise), pivoting at his bottom. */
  tilt?: number
  /** Eyes shut, asleep. */
  sleep?: boolean
  /** His hands tap (typing). */
  typing?: boolean
}

/** Where his short limbs join: the left arm on his straight edge, the right under the wing, the legs along his bottom. */
export const SHOULDERS: [Point, Point] = [[56, 146], [130, 154]]
export const HIPS: [Point, Point] = [[62, 198], [80, 184]]

const REST: [Point, Point] = [[32, 166], [158, 166]]
const FEET: [Point, Point] = [[54, 224], [90, 224]]
const SIT_FEET: [Point, Point] = [[50, 224], [104, 225]]

export const RIGS: Record<KersPose, Rig> = {
  standing: { dy: 0, hands: REST, feet: FEET },
  'walk-a': { dy: 0, hands: REST, feet: FEET },
  'walk-b': { dy: 0, hands: REST, feet: FEET },
  sitting: { dy: 12, hands: [[40, 186], [138, 190]], feet: SIT_FEET },
  'arms-up': { dy: -2, hands: [[30, 130], [148, 136]], feet: FEET },
  waving: { dy: 0, hands: [[28, 132], REST[1]], feet: FEET, wave: 'left' },
  asleep: { dy: 18, lying: true, hands: [[66, 182], [112, 184]], feet: SIT_FEET, prop: 'blanket' },
  rubbing: { dy: 12, hands: [[40, 186], [112, 132]], feet: SIT_FEET, front: true },
  laptop: { dy: 12, hands: [[76, 178], [112, 178]], feet: SIT_FEET, prop: 'laptop' },
  mug: { dy: 12, hands: [[78, 178], [112, 178]], feet: SIT_FEET, front: true, prop: 'mug' },
  reading: { dy: 12, hands: [[48, 178], [138, 176]], feet: SIT_FEET, front: true, prop: 'book' },
  meditating: { dy: 10, hands: [[40, 184], [140, 184]], feet: [[90, 222], [70, 222]], prop: 'cushion' },
  brushing: { dy: 0, hands: [REST[0], [112, 170]], feet: FEET, front: true, prop: 'toothbrush' },
  // At the desk. Hands land on the desk top (body y ~170 in the desk scenes).
  'desk-typing': { dy: 0, hands: [[121, 170], [157, 167]], feet: FEET, front: true, typing: true },
  'desk-mug': { dy: 0, hands: [[50, 170], [125, 139]], feet: FEET, front: true },
  'desk-lunch': { dy: 0, hands: [[50, 170], [153, 124]], feet: FEET, front: true },
  'desk-reading': { dy: 0, hands: [[36, 167], [143, 167]], feet: FEET, front: true },
  'desk-sulk': { dy: 0, hands: [[93, 160], [66, 160]], feet: FEET, front: true },
  'desk-asleep': { dy: 0, hands: [[120, 178], [150, 176]], feet: FEET, front: true, tilt: 58, sleep: true },
  'desk-rubbing': { dy: 0, hands: [[50, 170], [105, 134]], feet: FEET, front: true },
}
