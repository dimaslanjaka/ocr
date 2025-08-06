import Queue from 'bull';
import fs from 'fs-extra';
import path from 'path';
import { getImagePathFromUrlOrLocal, recognizeImage2 } from '../ocr/tesseract.js';
import { optimizeForOCR } from './image_utils/optimize-image.js';
import { extractVoucherCodes } from '../database/VoucherDatabase.js';
import { noop } from 'sbg-utility';

// Tesseract configuration
const _config = {
  lang: 'eng',
  oem: 1,
  psm: 3
};

// Create a Bull queue for OCR jobs
export const ocrQueue = new Queue('ocr-queue', {
  redis: { host: '127.0.0.1', port: 6379 },
  settings: {
    lockDuration: 10 * 60 * 1000, // 10 minutes
    stalledInterval: 1 * 60 * 1000, // 1 minute
    maxStalledCount: 5
  }
});

// Logging for Bull queue events
ocrQueue.on('waiting', (jobId) => {
  console.log(`[OCR QUEUE] Job waiting: ${jobId}`);
});
ocrQueue.on('active', (job, _jobPromise) => {
  console.log(`[OCR QUEUE] Job started: ${job.id}`);
});
ocrQueue.on('completed', (job, _result) => {
  console.log(`[OCR QUEUE] Job completed: ${job.id}`);
});
ocrQueue.on('failed', (job, err) => {
  console.error(`[OCR QUEUE] Job failed: ${job.id}`, err);
});

// OCR worker
ocrQueue.process(async (job) => {
  const { imagePath, imageUrl } = job.data;
  const input = imagePath || imageUrl;
  console.log(`[OCR QUEUE] Processing job: ${job.id}, input: ${input}`);
  try {
    const result = await _nodeOcr(input);
    await job.progress(100);
    return result;
  } catch (error) {
    console.error(`[OCR QUEUE] Error processing job ${job.id}:`, error);
    throw error; // This will mark the job as failed
  }
});

// OCR job processing functions
async function _nodeOcr(imagePathOrUrl) {
  // Extract image if URL, otherwise return local path
  const imagePath = await getImagePathFromUrlOrLocal(imagePathOrUrl);
  console.log(`[OCR QUEUE] Processing image: ${imagePath}`);
  const filename = path.basename(imagePath);
  try {
    // const text = await recognizeImagePython(imagePath, config);
    const optimizedImagePath = path.join(process.cwd(), `tmp/tesseract/optimized/${filename}`);
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
      fs.rm(imagePath, { force: true }).catch(noop);
    }, 5000);
    return { text: cleanText.join('\n'), vouchers };
  } catch (error) {
    setTimeout(() => {
      fs.rm(imagePath, { force: true }).catch(noop);
    }, 5000);
    throw error;
  }
}
