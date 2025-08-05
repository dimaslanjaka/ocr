import fs from 'fs-extra';
import Tesseract, { createWorker } from 'tesseract.js';
import path from 'upath';
import { extractVoucherCodes } from '../src/database/VoucherDatabase.js';
import { cropImageVariants } from '../src/ocr/image_utils.js';
import expectedVouchersJson from './fixtures/expected.json' with { type: 'json' };
import { optimizeForOCR } from '../src/ocr/image_utils/optimize-image.js';

/**
 * Shared Tesseract worker instance.
 * @type {import('tesseract.js').Worker | undefined}
 */
let worker;

/**
 * Initializes the shared Tesseract worker if not already created.
 * @async
 * @returns {Promise<void>}
 */
async function setupWorker() {
  if (!worker) {
    worker = await createWorker(
      ['eng', 'ind'],
      Tesseract.OEM.TESSERACT_LSTM_COMBINED,
      { cachePath: path.join(process.cwd(), 'tmp/worker-cache') },
      {}
    );
  }
}

/**
 * Terminates the shared Tesseract worker and optionally exits the process.
 * @async
 * @param {boolean} [exit=false] - Whether to exit the process after stopping the worker.
 * @param {number} [exitCode=0] - The exit code to use if exiting the process.
 * @returns {Promise<void>}
 */
async function stopWorker(exit = false, exitCode = 0) {
  if (worker) {
    await worker.terminate();
    worker = undefined;
  }
  if (exit) {
    // process.exit should only be called after all async cleanup is done
    process.exit(exitCode);
  }
}

// Remove 'exit' handler (cannot await async cleanup)
// Handle SIGINT and SIGTERM for graceful shutdown
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    await stopWorker();
    process.exit(0);
  });
});

/**
 * Main test runner for voucher OCR extraction.
 * @async
 * @returns {Promise<void>}
 */
(async () => {
  await setupWorker();
  // expectedVouchers is loaded but not used in this test runner
  const expectedVouchers = expectedVouchersJson
    .map((voucher) => Object.values(voucher))
    .flat()
    .map((code) => code.replace(/\s/g, ''));
  const collectedVouchers = [];
  const inputPath = path.join(process.cwd(), 'test/fixtures/voucher-fix.jpeg');
  const outputDir = path.join(process.cwd(), 'tmp/tesseract');

  const cropVariants = await cropImageVariants(inputPath, outputDir);
  for (const variant of cropVariants) {
    const result = await img2text(variant.outputPath);
    result.optimizedVouchers.forEach((voucher) => collectedVouchers.push(voucher));
    result.normalVouchers.forEach((voucher) => collectedVouchers.push(voucher));
  }

  const result = await img2text(inputPath);
  result.optimizedVouchers.forEach((voucher) => collectedVouchers.push(voucher));
  result.normalVouchers.forEach((voucher) => collectedVouchers.push(voucher));

  // Summarize collected vouchers
  const uniqueVouchers = new Set(collectedVouchers);
  console.log(`Collected Vouchers:`, uniqueVouchers);
  const missing = expectedVouchers.filter((v) => !uniqueVouchers.has(v));
  if (missing.length > 0) {
    console.log('Missing expected vouchers:', missing);
  }
  const unexpected = Array.from(uniqueVouchers).filter((v) => !expectedVouchers.includes(v));
  if (unexpected.length > 0) {
    console.log('Vouchers not listed in expected:', unexpected);
  }
  console.log(`Total collected vouchers: ${uniqueVouchers.size}`);
  console.log(`Total expected vouchers: ${expectedVouchers.length}`);
  await stopWorker();
  process.exit(0);
})();

/**
 * Runs OCR on an image and its optimized version, returning extracted text and voucher codes.
 * @async
 * @param {string} imagePath - Path to the image file.
 * @returns {Promise<{optimizedText: string, normalText: string, optimizedVouchers: string[], normalVouchers: string[]}>}
 */
async function img2text(imagePath) {
  const optimizedPath = path.join(
    process.cwd(),
    'tmp/tesseract/optimized',
    path.basename(imagePath, path.extname(imagePath)) + '.png'
  );
  fs.ensureDirSync(path.dirname(optimizedPath));
  const optimize = await optimizeForOCR(imagePath, optimizedPath);
  // Use shared worker
  if (!worker) {
    throw new Error('Worker not initialized. Call setupWorker() first.');
  }
  const optimizedOCR = await worker.recognize(optimize);
  const normalOCR = await worker.recognize(imagePath);
  return {
    optimizedText: optimizedOCR.data.text,
    normalText: normalOCR.data.text,
    optimizedVouchers: extractVoucherCodes(optimizedOCR.data.text, 'tmp/extract-vouchers'),
    normalVouchers: extractVoucherCodes(normalOCR.data.text, 'tmp/extract-vouchers')
  };
}
