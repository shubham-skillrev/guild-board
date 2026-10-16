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
  standing: { w: 420, h: 640, ready: true, eyes: [[158, 245], [250, 245]], eyeR: 40, tip: [110, 25], centre: [200, 330], hand: [380, 430], arms: [[-58, 70], [64, 74]] },
  sitting: { w: 477, h: 640, ready: true, eyes: [[140, 245], [232, 245]], eyeR: 40, tip: [90, 25], centre: [200, 330], hand: [330, 460], arms: [[40, -10], [-10, 40]] },
  'walk-a': { w: 470, h: 640, ready: true, eyes: [[215, 245], [305, 245]], eyeR: 40, tip: [165, 25], centre: [250, 330], hand: [440, 390], arms: [[-30, 84], [74, 54]] },
  'walk-b': { w: 462, h: 640, ready: true, eyes: [[195, 245], [285, 245]], eyeR: 40, tip: [150, 22], centre: [240, 330], hand: [420, 400], arms: [[-70, 54], [36, 84]] },
  'arms-up': { w: 428, h: 640, ready: true, eyes: [[175, 235], [262, 235]], eyeR: 38, tip: [140, 20], centre: [220, 320], hand: [400, 110], arms: [[-34, -96], [40, -96]] },
  waving: { w: 442, h: 640, ready: true, eyes: [[195, 245], [285, 245]], eyeR: 40, tip: [150, 25], centre: [240, 330], hand: [40, 180], arms: [[-58, 70], [52, -100]] },
  asleep: { w: 914, h: 640, ready: true, eyes: [[300, 230], [410, 248]], eyeR: 40, tip: [40, 70], centre: [400, 320], hand: [700, 420], arms: [[-40, 60], [40, 60]] },
  laptop: { w: 603, h: 640, ready: true, eyes: [[195, 225], [285, 225]], eyeR: 40, tip: [150, 25], centre: [240, 300], hand: [400, 440], arms: [[60, 40], [-10, 60]] },
  mug: { w: 478, h: 640, ready: true, eyes: [[125, 225], [212, 225]], eyeR: 38, tip: [55, 20], centre: [180, 280], hand: [230, 430], arms: [[54, -20], [-20, 40]] },
  reading: { w: 560, h: 640, ready: true, eyes: [[155, 215], [245, 215]], eyeR: 38, tip: [95, 20], centre: [220, 270], hand: [370, 440], arms: [[50, 30], [-10, 40]] },
  meditating: { w: 521, h: 640, ready: true, eyes: [[165, 215], [255, 215]], eyeR: 38, tip: [115, 20], centre: [220, 300], hand: [330, 410], arms: [[-30, 80], [30, 80]] },
  // Still to render (docs/kers/prompts.md, prompt 13).
  brushing: { ...frame, arms: [[-58, 70], [-40, -40]] },
}
