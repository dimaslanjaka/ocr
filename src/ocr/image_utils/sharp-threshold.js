import sharp from 'sharp';

export async function thresholdImage(inputPath, outputPath, level = 0.5) {
  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const pixels = Uint8ClampedArray.from(data); // RGBA

  // Apply your threshold filter
  thresholdFilter(pixels, level);

  // Save processed image
  await sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  }).toFile(outputPath);
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

// await thresholdImage('input.jpg', 'output.png', 0.5);
// console.log('Image processed!');
