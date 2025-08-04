import Queue from 'bull';
import fs from 'fs-extra';
import { recognizeImagePython } from '../ocr/tesseract.js';

// Tesseract configuration
const config = {
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
    const text = await recognizeImagePython(imagePath, config);
    setTimeout(() => {
      fs.rmSync(imagePath, { force: true });
    }, 5000);
    return { text };
  } catch (error) {
    setTimeout(() => {
      fs.rmSync(imagePath, { force: true });
    }, 5000);
    throw error;
  }
});
