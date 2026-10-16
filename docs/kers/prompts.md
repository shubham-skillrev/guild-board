# Kers: image prompts

Kers is GuildBot's character: a puffy, plush mouse cursor (↖). These prompts
make his renders. The app adds his eyes, brows, mood colour and cursor
states in code, so the renders deliberately leave those out.

**How to use**

1. Run **Prompt 1 (turnaround)** first, in ChatGPT (image), Gemini or
   Midjourney. Regenerate until the sheet looks right. This picture is the
   reference for everything else.
2. For each pose (Prompts 2 to 8), start a new image **with the chosen
   turnaround attached as a reference image**, and paste the prompt.
3. Save each pick as a PNG, at least 1024 px, named after the pose
   (`standing.png`, `sitting.png`, `walk-a.png`, `walk-b.png`, `arms-up.png`,
   `waving.png`, `asleep.png`) and send them over. They go through
   `scripts/kers-process.mjs`, which cuts out the background and turns the
   green piping into a layer the app can dye by mood.

**Rules every picture must follow** (they're repeated in each prompt):

- Cream-white minky plush body, nothing printed on it.
- The thick outline piping is **flat, pure chroma-key green (#00FF00)**,
  matte, so it can be recoloured. Nothing else in the picture is green.
- **Blank face**: no eyes, no mouth, no brows, no blush. Just smooth fabric
  in the upper middle of the arrowhead.
- Plain pure white background (#FFFFFF), or transparent if the tool can.
- One character, full body, centred, nothing cropped, a little empty space
  around him. Square image.

---

## Prompt 1: turnaround sheet

```
A character turnaround sheet of a cute plush toy named Kers, shown three times side by side on a plain pure white background: front view, three-quarter view, side view. Same character in all three, same size, standing.

The character: a classic computer mouse cursor arrow (the ↖ pointer), turned into a chubby, puffy, squishy plush toy. The arrowhead is his body: inflated like a soft pillow, rounded tip pointing up and to the left, its left edge almost vertical, its right edge slanting down to the right, all corners soft and rounded. The cursor's short stem, which normally sticks out of the bottom of the arrow, is his tail: a soft plush stub coming out of his lower back, angled down and to the right, behind him. Under the arrowhead he stands on two short, stubby plush legs with small round feet, side by side, in front of the tail. Two short stubby plush arms at his sides.

Material: cream-white minky plush (short soft pile, velvety, like a squishmallow), soft and slightly squashed, visible fine fabric texture, subtle stitched seams.

Piping: a thick rounded piping seam runs along his entire outline (arrowhead edge, tail, legs and arms are outlined too), in flat, matte, pure chroma-key green (#00FF00). Nothing else in the image is green.

Face: completely blank. No eyes, no mouth, no brows, no blush, no markings. Smooth fabric in the upper middle of the arrowhead, where a face would go.

Style: high-quality 3D render of a real plush toy, soft studio lighting from the top left, gentle soft shadow under his feet, shallow depth, cute and collectible, Pixar-like softness. No text, no labels, no background props.
```

## Prompt 2: standing

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours.

Kers standing, front view, facing the camera, relaxed and slightly squashed like a plush toy resting on a table. Arms hanging loosely at his sides, both feet flat on the ground side by side, tail curling out behind him to the lower right.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under his feet. High-quality 3D plush render.
```

## Prompt 3: sitting

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours.

Kers sitting down on the floor, front view, facing the camera, his two stubby legs stretched forward in front of him, both short arms reaching forward and slightly up at chest height as if resting his hands on a desk or holding a cup. Tail lying on the ground behind him to the lower right.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under him. High-quality 3D plush render.
```

## Prompt 4: walking, step A

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours.

Kers walking, front three-quarter view facing slightly to the right, mid-step: LEFT foot forward and lifted a little, right foot back on the ground, arms swinging opposite to the legs, body leaning slightly forward, tail bouncing up behind him.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under his feet. High-quality 3D plush render.
```

## Prompt 5: walking, step B

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours. Match the walking picture attached as well: same angle, same size, same lighting.

Kers walking, the next step: RIGHT foot forward and lifted a little, left foot back on the ground, arms swinging the other way, tail bouncing behind him.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under his feet. High-quality 3D plush render.
```

## Prompt 6: arms up

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours.

Kers front view, both short arms thrown straight up in the air, celebrating, body stretched a little taller like a plush being squeezed upward, standing on tiptoe on his two stubby feet, tail sticking out behind him.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under his feet. High-quality 3D plush render.
```

## Prompt 7: waving

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours.

Kers standing, front view, facing the camera, waving hello with his RIGHT arm raised beside his head, left arm relaxed at his side, both feet on the ground, tail curling out behind him.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush. Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under his feet. High-quality 3D plush render.
```

## Prompt 8: asleep

```
Use the attached turnaround as the exact reference for the character Kers: same shape, proportions, materials and colours.

Kers asleep, lying down on his side on the floor, curled up and squashed like a plush toy napping, arms tucked in, legs pulled up, tail curled around in front of his feet. Seen from the front.

Cream-white minky plush body. Thick outline piping in flat, matte, pure chroma-key green (#00FF00); nothing else green. Completely blank face: no eyes, mouth, brows or blush (we add closed eyes later). Plain pure white background, single character, full body, centred, nothing cropped, square image, soft studio light from the top left, soft shadow under him. High-quality 3D plush render.
```

---

## If something goes wrong

- **He gets eyes or a mouth anyway:** add "IMPORTANT: no facial features at all" at the very start of the prompt.
- **The piping comes out mint, teal or shaded green:** add "the piping is flat neon green like a green screen, no shading on it". Some shading is fine; the script keeps it.
- **He drifts off-model between poses:** always attach the turnaround, and say "same character, same proportions as the reference" again at the end.
- **The tail ends up in front of him or as a third leg:** "the tail comes out of his lower back and stays behind him; he has exactly two legs".
