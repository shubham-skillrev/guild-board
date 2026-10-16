// Turns Kers's raw renders (docs/kers/prompts.md) into the layers the app
// draws: the plush body, and his piping as a grey shading layer the app dyes
// by mood.
//
//   node scripts/kers-process.mjs <folder of PNGs>
//
// Each <pose>.png (standing, sitting, walk-a, walk-b, arms-up, waving,
// asleep) becomes public/kers/<pose>/body.webp and piping.webp, trimmed to
// the character, 640px tall. The white background (and the generator's
// floor shadow) is cut away; the chroma-green piping is split off, keeping
// its shading as grey. Prints each pose's size for src/components/kers/poses.ts.
import sharp from 'sharp'
import { mkdirSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

const POSES = ['standing', 'sitting', 'walk-a', 'walk-b', 'arms-up', 'waving', 'asleep']
const HEIGHT = 640
const PAD = 12

const dir = process.argv[2]
if (!dir) {
  console.error('Usage: node scripts/kers-process.mjs <folder of pose PNGs>')
  process.exit(1)
}

for (const file of readdirSync(dir).filter(f => f.endsWith('.png'))) {
  const pose = basename(file, '.png')
  if (!POSES.includes(pose)) { console.warn(`skip ${file}: not a pose name`); continue }
  const { data, info } = await sharp(join(dir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const px = (x, y) => (y * w + x) * 4

  // Background: near-white or pale grey, unsaturated, connected to the edge
  // (so the cream body, which is never touching the border, survives).
  const bg = new Uint8Array(w * h)
  const isBg = i => {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    return data[i + 3] < 10 || (max > 200 && max - min < 18)
  }
  const stack = []
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1])
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y])
  while (stack.length) {
    const [x, y] = stack.pop()
    if (x < 0 || y < 0 || x >= w || y >= h || bg[y * w + x]) continue
    if (!isBg(px(x, y))) continue
    bg[y * w + x] = 1
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  const body = Buffer.alloc(w * h * 4)
  const piping = Buffer.alloc(w * h * 4)
  let [x0, y0, x1, y1] = [w, h, 0, 0]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = px(x, y)
      if (bg[y * w + x]) continue
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      // How green: 0 for cream fabric, 1 for the piping.
      const green = Math.max(0, Math.min(1, (g - Math.max(r, b) - 30) / 90))
      const shade = Math.min(255, Math.round(g * 1.05))
      // Body: the fabric, with green spill pulled out at the piping's edges.
      const gSafe = Math.min(g, Math.max(r, b) + 8)
      body.set([r, gSafe, b, Math.round(a * (1 - green))], i)
      // Piping: its shading as grey, as opaque as it is green.
      piping.set([shade, shade, shade, Math.round(a * green)], i)
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
  }

  const crop = { left: Math.max(0, x0 - PAD), top: Math.max(0, y0 - PAD), width: 0, height: 0 }
  crop.width = Math.min(w, x1 + PAD) - crop.left
  crop.height = Math.min(h, y1 + PAD) - crop.top
  const out = join('public', 'kers', pose)
  mkdirSync(out, { recursive: true })
  for (const [name, buf] of [['body', body], ['piping', piping]]) {
    await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
      .extract(crop)
      .resize({ height: HEIGHT })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(join(out, `${name}.webp`))
  }
  const scaledW = Math.round((crop.width * HEIGHT) / crop.height)
  console.log(`${pose}: ${scaledW} x ${HEIGHT}  ->  ${out}/body.webp, piping.webp`)
}
