import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = resolve(root, "public");

const main = await readFile(resolve(pub, "icon.svg"));
const maskable = await readFile(resolve(pub, "icon-maskable.svg"));

const targets = [
  { src: main, name: "icon-192.png", size: 192 },
  { src: main, name: "icon-512.png", size: 512 },
  { src: main, name: "apple-touch-icon.png", size: 180 },
  { src: maskable, name: "icon-maskable-192.png", size: 192 },
  { src: maskable, name: "icon-maskable-512.png", size: 512 },
];

for (const t of targets) {
  const out = await sharp(t.src).resize(t.size, t.size).png().toBuffer();
  await writeFile(resolve(pub, t.name), out);
  console.log(`wrote public/${t.name} (${t.size}x${t.size})`);
}
