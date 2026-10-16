/**
 * Kers's poses, as rigs for his SVG (components/kers/Kers.tsx). He's the
 * classic cursor icon with stick limbs: thin lines ending in round hands and
 * feet. Everything is drawn in a 200 x 240 box with the ground at y 228.
 *
 * Shoulders and hips are in body coordinates (they move with him when he
 * sits, `dy`); hands are in body coordinates too; feet are on the ground.
 */
export type KersPose =
  | 'standing' | 'sitting' | 'walk-a' | 'walk-b' | 'arms-up' | 'waving' | 'asleep'
  // His day: at the laptop, coffee, a book, meditating, brushing his teeth.
  | 'laptop' | 'mug' | 'reading' | 'meditating' | 'brushing'

export type Point = [number, number]

export interface Rig {
  /** Body moved down (sitting). */
  dy: number
  /** Asleep: on his side. */
  lying?: boolean
  /** Where his hands end up (body coordinates). */
  hands: [Point, Point]
  /** Where his feet are (on the ground). */
  feet: [Point, Point]
  /** Arms in front of his body (holding things) rather than at his sides. */
  front?: boolean
  prop?: 'laptop' | 'mug' | 'book' | 'cushion' | 'toothbrush'
  /** The arm that waves. */
  wave?: 'left' | 'right'
}

/**
 * Where his limbs join the cursor: the left arm on his straight edge, the
 * right arm under the wing, both legs along the bottom edge, in front of the
 * stem (which hangs behind them like a tail).
 */
export const SHOULDERS: [Point, Point] = [[54, 116], [140, 125]]
export const HIPS: [Point, Point] = [[62, 160], [82, 141]]

const REST: [Point, Point] = [[22, 152], [166, 160]]
const FEET: [Point, Point] = [[54, 224], [94, 224]]
const SIT_FEET: [Point, Point] = [[44, 224], [102, 226]]

export const RIGS: Record<KersPose, Rig> = {
  standing: { dy: 0, hands: REST, feet: FEET },
  'walk-a': { dy: 0, hands: REST, feet: FEET },
  'walk-b': { dy: 0, hands: REST, feet: FEET },
  sitting: { dy: 24, hands: [[30, 176], [160, 182]], feet: SIT_FEET },
  'arms-up': { dy: -2, hands: [[24, 68], [170, 82]], feet: FEET },
  waving: { dy: 0, hands: [[20, 76], REST[1]], feet: FEET, wave: 'left' },
  asleep: { dy: 24, lying: true, hands: [[64, 150], [110, 150]], feet: SIT_FEET },
  laptop: { dy: 24, hands: [[78, 168], [112, 166]], feet: SIT_FEET, prop: 'laptop' },
  mug: { dy: 24, hands: [[70, 136], [98, 136]], feet: SIT_FEET, front: true, prop: 'mug' },
  reading: { dy: 24, hands: [[44, 150], [126, 146]], feet: SIT_FEET, front: true, prop: 'book' },
  meditating: { dy: 20, hands: [[38, 168], [146, 166]], feet: [[86, 222], [62, 222]], prop: 'cushion' },
  brushing: { dy: 0, hands: [REST[0], [98, 116]], feet: FEET, front: true, prop: 'toothbrush' },
}
