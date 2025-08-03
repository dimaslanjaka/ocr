import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * Crop an image into several variants: full, top_half, bottom_half, left_half, right_half.
 * @param {string|Buffer} imagePathOrBuffer - Path to image file or Buffer.
 * @returns {Promise<Array<{ name: string, buffer: Buffer, outputPath: string }>>}
 */
export async function cropImageVariants(imagePathOrBuffer) {
  const image = sharp(imagePathOrBuffer);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  const crops = [
    { name: 'full', region: { left: 0, top: 0, width, height } },
    { name: 'top_half', region: { left: 0, top: 0, width, height: Math.floor(height / 2) } },
    {
      name: 'bottom_half',
      region: { left: 0, top: Math.floor(height / 2), width, height: height - Math.floor(height / 2) }
    },
    { name: 'left_half', region: { left: 0, top: 0, width: Math.floor(width / 2), height } },
    {
      name: 'right_half',
      region: { left: Math.floor(width / 2), top: 0, width: width - Math.floor(width / 2), height }
    }
  ];

  // Determine base name for output files
  let baseName = 'buffer';
  if (typeof imagePathOrBuffer === 'string') {
    // Use URL only for http(s), otherwise use path.basename
    if (/^https?:\/\//i.test(imagePathOrBuffer)) {
      try {
        baseName = new URL(imagePathOrBuffer).pathname.split('/').pop() || 'image';
      } catch {
        baseName = 'image';
      }
    } else {
      baseName = path.basename(imagePathOrBuffer);
    }
  }

  const results = [];
  for (const crop of crops) {
    const buf = await sharp(imagePathOrBuffer).extract(crop.region).toBuffer();
    const outputDir = path.join(process.cwd(), 'tmp', 'crop');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${baseName.replace(/\.[^.]+$/, '')}_${crop.name}.png`);
    await fs.writeFile(outputPath, buf);
    results.push({ name: crop.name, buffer: buf, outputPath });
  }
  return results;
}
