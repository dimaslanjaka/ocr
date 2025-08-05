import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * Crops an image into several variants and saves them to disk.
 *
 * Variants produced:
 *   - full: the entire image
 *   - top_half: the top half of the image
 *   - bottom_half: the bottom half of the image
 *   - left_half: the left half of the image
 *   - right_half: the right half of the image
 *
 * @async
 * @param {string|Buffer} imagePathOrBuffer Path to the image file, image URL, or a Buffer containing image data.
 * @param {string} [outputDir] Optional output directory for cropped images. Defaults to '<cwd>/tmp/crop'.
 * @returns {Promise<Array<{ name: string, buffer: Buffer, outputPath: string }>>} Resolves with an array of objects for each crop variant:
 *   - name: the crop variant name
 *   - buffer: the cropped image as a Buffer
 *   - outputPath: the file path where the cropped image was saved
 */
export async function cropImageVariants(imagePathOrBuffer, outputDir = path.join(process.cwd(), 'tmp/crop')) {
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
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${baseName.replace(/\.[^.]+$/, '')}_${crop.name}.png`);
    await fs.writeFile(outputPath, buf);
    results.push({ name: crop.name, buffer: buf, outputPath });
  }
  return results;
}
