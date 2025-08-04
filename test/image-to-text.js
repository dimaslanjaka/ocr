import Tesseract from 'tesseract.js';
import { optimizeForOCR, advancedPreprocess } from './optimize-image.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract text from image using Tesseract OCR
 * @param {string} imagePath - Path to image file
 * @param {object} options - OCR options
 */
async function extractText(imagePath, options = {}) {
  const {
    lang = 'eng',
    psm = '6', // Page segmentation mode
    oem = '3' // OCR Engine mode
  } = options;

  try {
    console.log(`Processing image: ${imagePath}`);

    const { data } = await Tesseract.recognize(imagePath, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rProgress: ${Math.round(m.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem
    });

    return {
      text: data.text.trim(),
      confidence: data.confidence,
      words: data.words,
      lines: data.lines,
      paragraphs: data.paragraphs
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}

/**
 * Process image with optimization and OCR
 * @param {string} inputPath - Path to input image
 * @param {boolean} useAdvanced - Whether to use advanced preprocessing
 */
async function processImageToText(inputPath, useAdvanced = false) {
  try {
    // Create tmp directory if it doesn't exist
    const tmpDir = path.join(__dirname, 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    // Get image metadata to check dimensions
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(inputPath).metadata();
    console.log(`${inputPath.replace(process.cwd(), '')} (${metadata.width}x${metadata.height})`);

    // Optimize image for OCR
    const optimizedPath = path.join(tmpDir, `${useAdvanced ? 'advanced' : 'standard'}-optimized.png`);

    if (useAdvanced) {
      console.log('Using advanced preprocessing...');
      await advancedPreprocess(inputPath, optimizedPath);
    } else {
      console.log('Using standard optimization...');
      // Adjust scale factor based on image size
      const minWidth = 800;
      const scale = metadata.width < minWidth ? minWidth / metadata.width : 2.5;
      console.log(`Using scale factor: ${scale.toFixed(2)}`);

      await optimizeForOCR(inputPath, optimizedPath, {
        scale: scale,
        contrast: 1.3,
        brightness: 1.2
      });
    }

    // Extract text from optimized image
    const result = await extractText(optimizedPath);

    console.log('\n=== OCR RESULTS ===');
    console.log(`Confidence: ${result.confidence.toFixed(2)}%`);
    console.log(`Text length: ${result.text.length} characters`);
    console.log('\n===================');

    // Write extracted text to file
    const outputPath = path.join(tmpDir, `${useAdvanced ? 'advanced' : 'standard'}-ocr-result.txt`);
    await fs.writeFile(outputPath, result.text);

    return result;
  } catch (error) {
    console.error('Processing failed:', error);
    throw error;
  }
}

/**
 * Test OCR with the voucher image
 */
async function testOCR() {
  try {
    const inputImage = path.join(__dirname, 'fixtures/voucher-fix.jpeg');

    console.log('Testing standard optimization + OCR...');
    const standardResult = await processImageToText(inputImage, false);

    console.log('\n' + '='.repeat(50));
    console.log('Testing advanced preprocessing + OCR...');
    const advancedResult = await processImageToText(inputImage, true);

    // Compare results
    console.log('\n=== COMPARISON ===');
    console.log(`Standard confidence: ${standardResult.confidence.toFixed(2)}%`);
    console.log(`Advanced confidence: ${advancedResult.confidence.toFixed(2)}%`);
    console.log(`Standard text length: ${standardResult.text.length}`);
    console.log(`Advanced text length: ${advancedResult.text.length}`);

    const vouchers = [
      ['3028 8786 6115 0824', '1101 3200 0110 0001'],
      ['7124 6603 5145 1445', '1101 3200 0110 0002'],
      ['6035 3939 7924 0371', '1101 3200 0110 0003']
    ];

    const vouchersClean = vouchers.map((v) => v[0].replace(/\s/g, ''));
    const standardClean = standardResult.text.replace(/\s/g, '');
    const advancedClean = advancedResult.text.replace(/\s/g, '');

    console.log('\n=== VOUCHER DETECTION ===');
    console.log('Looking for vouchers:', vouchers.map((v) => v[0]).join(', '));

    let standardFound = 0;
    let advancedFound = 0;

    vouchersClean.forEach((v, index) => {
      const originalVoucher = vouchers[index][0];
      if (standardClean.includes(v)) {
        console.log(`✓ Standard found: ${originalVoucher}`);
        standardFound++;
      }
      if (advancedClean.includes(v)) {
        console.log(`✓ Advanced found: ${originalVoucher}`);
        advancedFound++;
      }
    });

    if (standardFound === 0 && advancedFound === 0) {
      console.log('❌ No voucher numbers detected');
    }

    console.log(`\nDetection summary: Standard (${standardFound}/3), Advanced (${advancedFound}/3)`);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

export { extractText, processImageToText, testOCR };

// Run test if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  testOCR();
}
