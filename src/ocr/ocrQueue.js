import Queue from 'bull';
import { spawnAsync } from 'cross-spawn';
import fs from 'fs-extra';
import path from 'upath';
import { extractVoucherCodes } from '../database/VoucherDatabase.js';

// Tesseract configuration
const _config = {
  lang: 'eng',
  oem: 1,
  psm: 3
};

// Create a Bull queue for OCR jobs
const concurrency = 5; // Set the desired concurrency level
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
ocrQueue.process(concurrency, async (job) => {
  const { imagePath, imageUrl } = job.data;
  const input = imagePath || imageUrl;
  console.log(`[OCR QUEUE] Processing job: ${job.id}, input: ${input}`);
  try {
    const args = [path.join(process.cwd(), 'src/ocr/cli.js'), input];
    console.log(`[OCR RUN] node ${args.join(' ')}`);
    const result = await spawnAsync('node', args, {
      stdio: 'pipe'
    })
      .then((res) => {
        const vouchers = res.output.split(/\r?\n/).flatMap((line) => extractVoucherCodes(line, 'tmp/extract-vouchers'));
        return {
          text: res.output,
          vouchers
        };
      })
      .finally(async () => {
        try {
          return await fs.rm(imagePath, { force: true, recursive: true });
        } catch {
          // Ignore errors if the file cannot be removed
        }
      });
    await job.progress(100);
    return result;
  } catch (error) {
    console.error(`[OCR QUEUE] Error processing job ${job.id}:`, error);
    throw error; // This will mark the job as failed
  }
});
