// Maakt de 7 foto-niveaus (0 = heel wazig, 6 = scherp) uit één bronfoto.
// Gebruik: zet je foto als private/photo/source.jpg (of .png/.webp) en run `npm run photo`.
// Optioneel een uitsnede: `npm run photo -- --crop=x,y,breedte,hoogte` (in pixels van de bronfoto).
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = path.join(process.cwd(), "private", "photo");
const W = 800;
const H = 1000;

// Per niveau: hoe klein de foto eerst wordt (pixels breed) en hoeveel blur erover gaat.
// Door eerst te verkleinen zit er op de lage niveaus echt geen detail meer in.
const LEVELS = [
  { width: 10, blur: 6 },
  { width: 14, blur: 5 },
  { width: 22, blur: 4 },
  { width: 34, blur: 3 },
  { width: 60, blur: 2 },
  { width: 140, blur: 1 },
  { width: W, blur: 0 },
];

const files = await readdir(dir);
const source = files.find((f) => /^source\.(jpe?g|png|webp)$/i.test(f));
if (!source) {
  console.error("Geen bronfoto gevonden: zet je foto als private/photo/source.jpg");
  process.exit(1);
}

const cropArg = process.argv.find((a) => a.startsWith("--crop="));
let base = sharp(path.join(dir, source)).rotate();
if (cropArg) {
  const [left, top, width, height] = cropArg.slice(7).split(",").map(Number);
  base = base.extract({ left, top, width, height });
}
const sharpPhoto = await base
  .resize(W, H, { fit: "cover", position: sharp.strategy.attention })
  .toBuffer();

for (const [index, level] of LEVELS.entries()) {
  let image = sharp(sharpPhoto);
  if (level.width < W) {
    const small = await image.resize(level.width).toBuffer();
    image = sharp(small).resize(W, H, { kernel: "cubic" });
    if (level.blur) image = sharp(await image.toBuffer()).blur(level.blur);
  }
  await image.jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(dir, `level-${index}.jpg`));
  console.log(`level-${index}.jpg klaar`);
}
