import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Splits an image into two parts based on specified options
 * @param {string} inputPath - Path to the input image file
 * @param {string} outputDir - Directory where split images will be saved
 * @param {Object} [options={}] - Configuration options for splitting
 * @param {string} [options.direction='horizontal'] - Split direction: 'horizontal' or 'vertical'
 * @param {number} [options.ratio=0.5] - Split ratio from 0.1 to 0.9 (where to make the split)
 * @param {string} [options.format='png'] - Output format: 'jpeg', 'png', or 'webp'
 * @param {number} [options.quality=90] - Quality for jpeg/webp format (1-100)
 * @param {string[]} [options.suffix=['left', 'right']] - Custom suffixes for output filenames
 * @returns {Promise<string[]>} Array containing paths to the two split image files
 * @throws {Error} When image processing fails
 *
 * @example
 * // Default horizontal split (50/50)
 * const [leftPath, rightPath] = await splitImage('input.jpg', './output');
 *
 * @example
 * // Vertical split with custom ratio and format
 * const [topPath, bottomPath] = await splitImage('input.jpg', './output', {
 *   direction: 'vertical',
 *   ratio: 0.7,
 *   format: 'png',
 *   suffix: ['top', 'bottom']
 * });
 */
export async function splitImage(inputPath, outputDir, options = {}) {
  // Default options
  const {
    direction = 'horizontal', // 'horizontal' or 'vertical'
    ratio = 0.5, // Split ratio (0.1 to 0.9)
    format = 'png', // 'jpeg', 'png', 'webp'
    quality = 90, // Quality for jpeg/webp
    suffix = ['left', 'right'] // Custom suffixes for output files
  } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get image metadata
  const image = sharp(inputPath);
  const { width, height } = await image.metadata();

  const inputFilename = path.basename(inputPath, path.extname(inputPath));
  const extension = format === 'jpeg' ? 'jpg' : format;

  let firstPath, secondPath, firstExtract, secondExtract;

  if (direction === 'horizontal') {
    const splitPoint = Math.floor(width * ratio);

    firstPath = path.join(outputDir, `${inputFilename}-${suffix[0]}.${extension}`);
    secondPath = path.join(outputDir, `${inputFilename}-${suffix[1]}.${extension}`);

    firstExtract = { left: 0, top: 0, width: splitPoint, height };
    secondExtract = { left: splitPoint, top: 0, width: width - splitPoint, height };
  } else {
    const splitPoint = Math.floor(height * ratio);

    firstPath = path.join(outputDir, `${inputFilename}-${suffix[0]}.${extension}`);
    secondPath = path.join(outputDir, `${inputFilename}-${suffix[1]}.${extension}`);

    firstExtract = { left: 0, top: 0, width, height: splitPoint };
    secondExtract = { left: 0, top: splitPoint, width, height: height - splitPoint };
  }

  // Create format-specific pipeline
  const createPipeline = (extract) => {
    let pipeline = sharp(inputPath).extract(extract);

    switch (format) {
      case 'jpeg':
        return pipeline.jpeg({ quality });
      case 'png':
        return pipeline.png();
      case 'webp':
        return pipeline.webp({ quality });
      default:
        return pipeline.jpeg({ quality });
    }
  };

  // Split first part
  await createPipeline(firstExtract).toFile(firstPath);

  // Split second part
  await createPipeline(secondExtract).toFile(secondPath);

  return [firstPath, secondPath];
}

// Example usage with custom options
const inputPath = path.join(process.cwd(), 'test', 'fixtures', 'voucher - normalized rotation.jpeg');
const outputDir = path.join(process.cwd(), 'tmp');

// Default horizontal split
splitImage(inputPath, outputDir);

// Custom vertical split with 70/30 ratio
// splitImage(inputPath, outputDir, {
//   direction: 'vertical',
//   ratio: 0.7,
//   format: 'png',
//   suffix: ['top', 'bottom']
// });
//   direction: 'vertical',
//   ratio: 0.7,
//   format: 'png',
//   suffix: ['top', 'bottom']
// });
