# Kers: image prompts

Kers is GuildBot's character: a plush mouse cursor (↖). These prompts make
his renders. The app adds his eyes, brows, mood colour and cursor states in
code, so the renders deliberately leave those out.

Two reference pictures live in `docs/kers/renders/`:

- **`shape-reference.png`**: his SHAPE. The tilted ↖ cursor arrow, the stem
  as a tail, two legs, two arms.
- **`finish-reference.png`**: his FINISH only. Matte short-pile fabric, a
  dart seam pinched at the tip, fine piping, sculpted feet. Its shape is
  wrong on purpose (it drifted into a symmetric ↑ up arrow); never copy the
  shape from it.

**How to use**

1. Run **Prompt 1 (turnaround)** with **both** reference pictures attached.
   Regenerate until it's the tilted ↖ cursor with the new finish. Save the
   pick as `docs/kers/renders/turnaround.png`.
2. For each pose (Prompts 2 to 13), start a new image with **the new
   turnaround attached**, and paste the prompt. For walk B, attach walk A too.
3. Save each pick as a PNG, at least 1024 px, named exactly as in its
   heading (`standing.png`, `laptop.png`, ...) and send them over. They go
   through `scripts/kers-process.mjs`, which cuts out the background and
   turns the green piping into a layer the app dyes by mood.

**Rules every picture must follow** (repeated in each prompt):

- The shape is the **tilted ↖ cursor**: left edge straight and vertical, tip
  pointing up and to the LEFT, right edge slanting down to the right. It is
  **not symmetric** and **not an up arrow**.
- Cream-white plush, matte short pile, nothing printed on it.
- The piping runs **only around the edge of the arrowhead's front panel**,
  in **flat, pure chroma-key green (#00FF00)**. Arms, legs, feet and tail
  have **no piping**. Nothing else in the picture is green.
- **Blank face**: no eyes, no mouth, no brows, no blush.
- Plain pure white background (#FFFFFF), or transparent if the tool can.
- One character, full body, centred, nothing cropped, a little empty space
  around him. Square image. No props unless the prompt asks for one.

---

## Prompt 1: turnaround → `turnaround.png`

Attach `shape-reference.png` and `finish-reference.png`.

```
Two reference images are attached. Image 1 sets the character's SHAPE. Image 2 sets the MATERIAL and FINISH only: ignore its shape completely (it is wrongly drawn as a symmetric up arrow).

A character turnaround sheet of a plush toy named Kers, shown three times side by side on a plain pure white background: front view, three-quarter view, side view. Same character in all three, same size, standing.

SHAPE (from image 1): a classic computer mouse cursor arrow, the tilted ↖ pointer, made into a chubby, soft plush toy. The arrowhead is his body. Its LEFT edge is straight and vertical. The tip points up and to the LEFT. The right edge slants down to the right to a rounded corner, then steps in, like the real cursor. It is NOT symmetric and NOT an up arrow. The cursor's short stem is his tail: a soft plush stub out of his lower back, angled down and to the right, behind him. Under the arrowhead he stands on two short legs with sculpted rounded feet, side by side, in front of the tail. Two short stubby arms at his sides.

FINISH (from image 2): cream-white plush with a matte short pile, soft and slightly squashed, a dart seam pinched at the tip, neat construction like a premium store-bought plush.

PIPING: a fine rounded piping cord runs ONLY around the edge of the arrowhead's front panel, in flat, matte, pure chroma-key green (#00FF00). Arms, legs, feet, tail and the back of the arrowhead have NO piping. Nothing else in the image is green.

FACE: completely blank. No eyes, no mouth, no brows, no blush, no markings.

Style: high-quality 3D render of a real plush toy, soft studio lighting from the top left, gentle soft shadow under his feet. No text, no labels, no props.
```

## The poses

Each pose prompt starts with the same block, then the pose. Attach the new
turnaround (`turnaround.png`) every time.

**Shared block** (paste first, every time):

```
Use the attached turnaround as the exact reference for the character Kers: the same tilted ↖ cursor shape (left edge vertical, tip pointing up and to the LEFT, not symmetric, not an up arrow), the same proportions, two legs, two arms, the stem as a tail behind him, the same cream matte short-pile plush.

Fine piping ONLY around the edge of the arrowhead's front panel, in flat, matte, pure chroma-key green (#00FF00); arms, legs, feet and tail have no piping; nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under him. High-quality 3D plush render.
```

Then add the pose line:

### Prompt 2: `standing.png`

```
Pose: standing, front view, facing the camera, relaxed and slightly squashed like a plush resting on a table. Arms hanging loosely at his sides, both feet flat, tail out behind him to the lower right.
```

### Prompt 3: `sitting.png`

```
Pose: sitting on the floor, front view, facing the camera, both legs stretched forward, both arms resting on his lap. Tail lying on the ground behind him to the lower right.
```

### Prompt 4: `walk-a.png`

```
Pose: walking, front three-quarter view facing slightly to the right, mid-step: LEFT foot forward and lifted a little, right foot back on the ground, arms swinging opposite to the legs, body leaning slightly forward, tail bouncing up behind him.
```

### Prompt 5: `walk-b.png`

Attach `walk-a.png` as well.

```
Pose: the next step of the attached walking picture, same angle, same size, same lighting: RIGHT foot forward and lifted a little, left foot back on the ground, arms swinging the other way, tail bouncing behind him.
```

### Prompt 6: `arms-up.png`

```
Pose: front view, both arms thrown straight up, celebrating, body stretched a little taller like a plush being squeezed upward, on tiptoe, tail out behind him.
```

### Prompt 7: `waving.png`

```
Pose: standing, front view, facing the camera, waving hello with one arm raised beside his head, the other arm relaxed at his side, both feet on the ground, tail out behind him.
```

### Prompt 8: `asleep.png`

```
Pose: asleep, lying on his side on the floor, curled up and squashed like a plush toy napping, arms tucked in, legs pulled up, tail curled around in front of his feet. Seen from the front, the front panel facing the camera.
```

### Prompt 9: `laptop.png`

```
Pose: sitting on the floor behind a small open laptop, front view, facing the camera over the top of the laptop, both arms reaching forward onto the keyboard as if typing. The laptop is a plain matte dark grey, no logo, no screen visible from the front (we see the back of the lid). Tail on the ground behind him.
```

### Prompt 10: `mug.png`

```
Pose: sitting on the floor, front view, holding a plain cream ceramic mug in both arms close to his chest, a wisp of steam. The mug has no logo or text. Tail on the ground behind him.
```

### Prompt 11: `reading.png`

```
Pose: sitting on the floor, front view, holding an open hardback book in both arms in front of his body, low enough that the upper half of his front panel (where his face goes) is fully visible above the book. Plain book cover, no title. Tail on the ground behind him.
```

### Prompt 12: `meditating.png`

```
Pose: sitting cross-legged on a small round cushion, front view, arms resting on his knees, very calm and upright, tail curled beside the cushion. The cushion is plain muted terracotta, no pattern.
```

### Prompt 13: `brushing.png`

```
Pose: standing, front view, facing the camera, holding a small toothbrush in one arm, brushing near the middle of his front panel (where a mouth would be), a little white foam, the other arm on his side. The toothbrush is plain blue and white.
```

---

## If something goes wrong

- **He comes out as a symmetric ↑ up arrow:** start the prompt with "IMPORTANT: a tilted ↖ mouse cursor, left edge vertical, tip at the top LEFT, not symmetric". Attach only the turnaround, not the finish reference.
- **He gets eyes or a mouth anyway:** add "IMPORTANT: no facial features at all" at the very start.
- **Piping appears on the arms, legs or tail:** add "piping only on the front panel edge, nowhere else".
- **The piping comes out mint, teal or shaded:** add "the piping is flat neon green like a green screen". Some shading is fine; the script keeps it.
- **The props cover his face (book, mug, laptop):** add "the upper half of his front panel stays clear and visible".
- **He drifts off-model between poses:** always attach the turnaround, and repeat "same character, same proportions as the reference" at the end.
