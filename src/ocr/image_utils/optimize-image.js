import sharp from 'sharp';
import path from 'upath';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Optimize image for Tesseract OCR
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save optimized image
 * @param {object} options - Optimization options
 */
async function optimizeForOCR(inputPath, outputPath, options = {}) {
  const {
    scale = 2, // Scale factor for better resolution
    contrast = 1.2, // Enhance contrast
    brightness = 1.1, // Slight brightness increase
    sharpen = true, // Apply sharpening
    denoise = true // Remove noise
  } = options;
  // const imageExtension = path.extname(inputPath).toLowerCase();

  try {
    let pipeline = sharp(inputPath);

    // Convert to grayscale for better OCR
    pipeline = pipeline.grayscale();

    // Scale up for better character recognition
    pipeline = pipeline.resize({
      width: Math.round((await getImageWidth(inputPath)) * scale),
      kernel: sharp.kernel.cubic
    });

    // Enhance contrast and brightness
    pipeline = pipeline.modulate({
      brightness: brightness,
      contrast: contrast
    });

    // Apply sharpening if enabled
    if (sharpen) {
      pipeline = pipeline.sharpen();
    }

    // Remove noise if enabled
    if (denoise) {
      pipeline = pipeline.median(3);
    }

    // Normalize and enhance edges
    pipeline = pipeline.normalize();

    // Save as high-quality PNG
    await pipeline.png({ quality: 100, compressionLevel: 0 }).toFile(outputPath);

    // console.log(`Image optimized for OCR: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw error;
  }
}

/**
 * Get image width helper function
 */
async function getImageWidth(imagePath) {
  const metadata = await sharp(imagePath).metadata();
  return metadata.width;
}

/**
 * Advanced preprocessing for difficult images
 */
async function advancedPreprocess(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .grayscale()
      .resize({ width: 2000, kernel: sharp.kernel.cubic })
      .modulate({ brightness: 1.2, contrast: 1.5 })
      .sharpen({ sigma: 1, m1: 0.5, m2: 2 })
      .threshold(128) // Convert to pure black and white
      .median(3) // Remove noise
      .png({ quality: 100 })
      .toFile(outputPath);

    console.log(`Advanced preprocessing complete: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error in advanced preprocessing:', error);
    throw error;
  }
}

// Test the optimization
async function testOptimization() {
  try {
    console.log('Starting image optimization test...');

    // Example usage
    const inputImage = path.join(__dirname, 'fixtures/voucher-fix.jpeg');
    const outputImage = path.join(__dirname, 'tmp/optimized-for-ocr.png');

    console.log(`Input: ${inputImage}`);
    console.log(`Output: ${outputImage}`);

    await optimizeForOCR(inputImage, outputImage, {
      scale: 2.5,
      contrast: 1.3,
      brightness: 1.2
    });

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

export { optimizeForOCR, advancedPreprocess, testOptimization };

// Run test if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  testOptimization();
}
