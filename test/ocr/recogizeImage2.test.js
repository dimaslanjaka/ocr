import { describe, expect, jest } from '@jest/globals';
import path from 'path';
import { extractVoucherCodes } from '../../src/database/VoucherDatabase.js';
import { optimizeForOCR } from '../../src/ocr/image_utils/optimize-image.js';
import { recognizeImage2, setupWorker, stopWorker } from '../../src/ocr/tesseract.js';
import expectedVouchersJson from '../fixtures/expected.json' with { type: 'json' };

jest.setTimeout(300 * 1000); // Set a longer timeout for tests

describe('OCR Image Recognition', () => {
  const expectedVouchers = expectedVouchersJson
    .map((voucher) => Object.values(voucher))
    .flat()
    .map((code) => code.replace(/\s/g, ''));

  beforeAll(async () => {
    // Setup shared Tesseract worker before tests
    await setupWorker();
  });

  afterAll(async () => {
    // Cleanup shared Tesseract worker after tests
    await stopWorker();
  });

  it('should recognize text from an image', async () => {
    const imagePath = path.join(process.cwd(), 'test/fixtures/voucher-fix.jpeg');

    // Pre-process the image
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

    console.log(`total vouchers found: ${vouchers.length}`);
    console.log(`total expected vouchers: ${expectedVouchers.length}`);
    const expectedFoundCount = expectedVouchers.filter((ev) => vouchers.includes(ev)).length;
    expect(expectedFoundCount).toBeGreaterThan(0);
    console.log(`total expected vouchers found in vouchers: ${expectedFoundCount}`);
    const unexpectedCount = vouchers.filter((v) => !expectedVouchers.includes(v)).length;
    console.log(`total unexpected vouchers found in vouchers: ${unexpectedCount}`);

    // Check that at least one expected voucher is found in vouchers
    const found = expectedVouchers.some((ev) => vouchers.includes(ev));
    expect(found).toBe(true);
  });
});
