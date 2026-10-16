/**
 * Kers's poses: one rendered picture each (docs/kers/prompts.md, processed by
 * scripts/kers-process.mjs into public/kers/<pose>/body.webp + piping.webp).
 *
 * The app draws his face and cursor states over the picture, so each pose
 * says where things are, in the processed image's pixels (640px tall):
 * his eyes, the cursor tip (click ripples), his middle (the loader ring)
 * and his right hand (the I-beam caret, props).
 *
 * `ready: false` until that pose's render has been processed; the sheet
 * shows a rough placeholder in its place (KersPlaceholder) so everything
 * around him can be built and checked first.
 */
export type KersPose = 'standing' | 'sitting' | 'walk-a' | 'walk-b' | 'arms-up' | 'waving' | 'asleep'

type Point = [number, number]

export interface PoseSpec {
  /** Size of the processed images. */
  w: number
  h: number
  ready: boolean
  eyes: [Point, Point]
  /** Eye radius, in the image's pixels. */
  eyeR: number
  tip: Point
  centre: Point
  hand: Point
  /** For the placeholder only: where its arms reach, from the shoulders. */
  arms: [Point, Point]
  /** For the placeholder only: lift a foot (walking). */
  step?: 'left' | 'right'
  /** For the placeholder only: lying down. */
  lying?: boolean
}

// Until the renders land, every pose shares the placeholder's frame.
const frame = { w: 600, h: 640, ready: false, eyes: [[232, 292], [328, 292]] as [Point, Point], eyeR: 44, tip: [176, 78] as Point, centre: [290, 330] as Point, hand: [462, 420] as Point }

export const KERS_POSES: Record<KersPose, PoseSpec> = {
  standing: { ...frame, arms: [[-58, 70], [64, 74]] },
  sitting: { ...frame, arms: [[40, -10], [-10, 40]], hand: [420, 330] },
  'walk-a': { ...frame, arms: [[-30, 84], [74, 54]], step: 'left' },
  'walk-b': { ...frame, arms: [[-70, 54], [36, 84]], step: 'right' },
  'arms-up': { ...frame, arms: [[-34, -96], [40, -96]] },
  waving: { ...frame, arms: [[-58, 70], [52, -100]], hand: [440, 230] },
  asleep: { ...frame, arms: [[-40, 60], [40, 60]], lying: true },
}
