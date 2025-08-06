import Queue from 'bull';
import fs from 'fs-extra';
import path from 'path';
import { recognizeImage2 } from '../ocr/tesseract.js';
import { optimizeForOCR } from './image_utils/optimize-image.js';
import { extractVoucherCodes } from '../database/VoucherDatabase.js';

// Tesseract configuration
const _config = {
  lang: 'eng',
  oem: 1,
  psm: 3
};

// Create a Bull queue for OCR jobs
export const ocrQueue = new Queue('ocr-queue', {
  redis: { host: '127.0.0.1', port: 6379 }
});

// OCR worker
ocrQueue.process(async (job) => {
  const { imagePath } = job.data;
  try {
    // const text = await recognizeImagePython(imagePath, config);
    const optimizedImagePath = path.join(process.cwd(), 'tmp/tesseract/optimized.png');
    await optimizeForOCR(imagePath, optimizedImagePath);
    const options = { outputDir: 'tmp/tesseract', split: true };
    const result = await recognizeImage2(optimizedImagePath, options);
    const cleanText = Object.values(result).flatMap((text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    );
    const vouchers = cleanText.flatMap((line) => extractVoucherCodes(line, 'tmp/extract-vouchers'));
    setTimeout(() => {
      fs.rmSync(imagePath, { force: true });
    }, 5000);
    return { text: cleanText.join('\n'), vouchers };
  } catch (error) {
    setTimeout(() => {
      fs.rmSync(imagePath, { force: true });
    }, 5000);
    throw error;
  }
});
