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
  // Walking: leaning into the step.
  'walk-a': { dy: 0, hands: REST, feet: FEET, tilt: -6 },
  'walk-b': { dy: 0, hands: REST, feet: FEET, tilt: -6 },
  // Sitting: leaning back, hands on his knees.
  sitting: { dy: 12, hands: [[44, 190], [136, 192]], feet: SIT_FEET, tilt: 5 },
  // Arms up: reaching high, a little lift onto his toes. Never stretched: his shape stays his shape.
  'arms-up': { dy: -6, hands: [[22, 100], [164, 108]], feet: FEET, tilt: 3 },
  // Waving: leaning into the wave.
  waving: { dy: 0, hands: [[22, 104], REST[1]], feet: FEET, wave: 'left', tilt: -6 },
  asleep: { dy: 18, lying: true, hands: [[66, 182], [112, 184]], feet: SIT_FEET, prop: 'blanket' },
  rubbing: { dy: 12, hands: [[40, 186], [104, 128]], feet: SIT_FEET, front: true, tilt: 4 },
  laptop: { dy: 12, hands: [[76, 178], [112, 178]], feet: SIT_FEET, prop: 'laptop' },
  mug: { dy: 12, hands: [[80, 176], [110, 176]], feet: SIT_FEET, front: true, prop: 'mug', tilt: 3 },
  reading: { dy: 12, hands: [[48, 178], [138, 176]], feet: SIT_FEET, front: true, prop: 'book', tilt: 2 },
  meditating: { dy: 10, hands: [[40, 184], [140, 184]], feet: [[90, 222], [70, 222]], prop: 'cushion' },
  brushing: { dy: 0, hands: [REST[0], [108, 160]], feet: FEET, front: true, prop: 'toothbrush', tilt: -4 },
  // At the desk. Hands land on the desk top (body y ~170 in the desk scenes).
  'desk-typing': { dy: 0, hands: [[121, 170], [157, 167]], feet: FEET, front: true, typing: true },
  'desk-mug': { dy: 0, hands: [[50, 170], [125, 139]], feet: FEET, front: true },
  'desk-lunch': { dy: 0, hands: [[50, 170], [153, 124]], feet: FEET, front: true },
  'desk-reading': { dy: 0, hands: [[36, 167], [143, 167]], feet: FEET, front: true },
  'desk-sulk': { dy: 0, hands: [[93, 160], [66, 160]], feet: FEET, front: true },
  'desk-asleep': { dy: 0, hands: [[120, 178], [150, 176]], feet: FEET, front: true, tilt: 58, sleep: true },
  'desk-rubbing': { dy: 0, hands: [[50, 170], [105, 134]], feet: FEET, front: true },
}
