import { createCanvas, loadImage } from 'canvas';
import fs from 'fs-extra';
import path from 'path';

export async function thresholdImage(inputPath, outputPath) {
  fs.ensureDirSync(path.dirname(outputPath));
  const img = await loadImage(inputPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  thresholdFilter(imageData.data, 0.5);
  ctx.putImageData(imageData, 0, 0);

  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
}

function thresholdFilter(pixels, level = 0.5) {
  const thresh = Math.floor(level * 255);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const val = gray >= thresh ? 255 : 0;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = val;
  }
}

// await processImage('input.jpg', 'output.png');
// console.log('Done!');
