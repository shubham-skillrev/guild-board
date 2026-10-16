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
export type KersPose =
  | 'standing' | 'sitting' | 'walk-a' | 'walk-b' | 'arms-up' | 'waving' | 'asleep'
  // His day: at the laptop, coffee, a book, meditating, brushing his teeth.
  | 'laptop' | 'mug' | 'reading' | 'meditating' | 'brushing'

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

// The placeholder's frame, for poses still waiting on a render.
const frame = { w: 600, h: 640, ready: false, eyes: [[232, 292], [328, 292]] as [Point, Point], eyeR: 44, tip: [176, 78] as Point, centre: [290, 330] as Point, hand: [462, 420] as Point }

export const KERS_POSES: Record<KersPose, PoseSpec> = {
  standing: { w: 474, h: 640, ready: true, eyes: [[158, 232], [258, 232]], eyeR: 42, tip: [100, 40], centre: [230, 330], hand: [400, 405], arms: [[-58, 70], [64, 74]] },
  sitting: { w: 525, h: 640, ready: true, eyes: [[148, 252], [250, 252]], eyeR: 44, tip: [72, 40], centre: [220, 330], hand: [350, 410], arms: [[40, -10], [-10, 40]] },
  'walk-a': { w: 466, h: 640, ready: true, eyes: [[178, 232], [278, 232]], eyeR: 42, tip: [120, 30], centre: [250, 330], hand: [410, 400], arms: [[-30, 84], [74, 54]] },
  // No second step rendered yet: walking alternates walk-a with standing.
  'walk-b': { ...frame, arms: [[-70, 54], [36, 84]], step: 'right' },
  'arms-up': { w: 497, h: 640, ready: true, eyes: [[175, 232], [275, 232]], eyeR: 42, tip: [115, 35], centre: [240, 330], hand: [440, 240], arms: [[-34, -96], [40, -96]] },
  waving: { w: 481, h: 640, ready: true, eyes: [[178, 232], [278, 232]], eyeR: 42, tip: [120, 30], centre: [240, 330], hand: [45, 205], arms: [[-58, 70], [52, -100]] },
  asleep: { w: 1046, h: 640, ready: true, eyes: [[330, 248], [450, 262]], eyeR: 44, tip: [60, 110], centre: [480, 330], hand: [870, 400], arms: [[-40, 60], [40, 60]] },
  // Still to render (docs/kers/prompts.md, prompts 9 to 13).
  laptop: { ...frame, arms: [[60, 40], [-10, 60]] },
  mug: { ...frame, arms: [[54, -20], [-20, 40]] },
  reading: { ...frame, arms: [[50, 30], [-10, 40]] },
  meditating: { ...frame, arms: [[-30, 80], [30, 80]] },
  brushing: { ...frame, arms: [[-58, 70], [-40, -40]] },
}
