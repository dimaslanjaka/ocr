import minimist from 'minimist';
import { pathToFileURL } from 'node:url';
import path from 'upath';
import { extractVoucherCodes } from '../database/VoucherDatabase.js';
import { getImagePathFromUrlOrLocal, recognizeImage2, stopWorker } from '../ocr/tesseract.js';
import { optimizeForOCR } from './image_utils/optimize-image.js';
import { writefile } from 'sbg-utility';

// Usage:
// node src/ocr/cli.js test/fixtures/voucher.jpeg

async function _nodeOcr(imagePathOrUrl) {
  // Extract image if URL, otherwise return local path
  const imagePath = await getImagePathFromUrlOrLocal(imagePathOrUrl);
  const filename = path.basename(imagePath);
  // const text = await recognizeImagePython(imagePath, config);
  const optimizedImagePath = path.join(process.cwd(), `tmp/tesseract/optimized/${filename}`);
  await optimizeForOCR(imagePath, optimizedImagePath);
  const options = { outputDir: 'tmp/tesseract', split: false };
  const result = await recognizeImage2(optimizedImagePath, options);
  const cleanText = Object.values(result).flatMap((text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
  const vouchers = cleanText.flatMap((line) => extractVoucherCodes(line, 'tmp/extract-vouchers'));
  return { text: cleanText.join('\n'), vouchers };
}

// Detect if the script is run directly in both CommonJS and ESM
let isMain = false;

try {
  // CommonJS detection
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    isMain = true;
  }
} catch (_e) {
  // Ignore errors in ESM environments
}

try {
  // ES Module detection
  const mainArg = process.argv[1] && path.resolve(process.argv[1]);
  if (mainArg && import.meta.url === pathToFileURL(mainArg).href) {
    isMain = true;
  }
} catch (_e) {
  // Ignore errors in CommonJS environments
}

// CLI entry point
if (isMain) {
  const argv = minimist(process.argv.slice(2));
  const input = argv._[0];
  if (!input) {
    console.error('Usage: node cli.js <imagePathOrUrl>');
    process.exit(1);
  }
  _nodeOcr(input)
    .then((result) => {
      console.log('OCR successful!');
      const debugFile = path.join(
        process.cwd(),
        'tmp/tesseract/debug',
        path.basename(input, path.extname(input)) + '.log'
      );
      let debugContent = `Input: ${input}\n\n`;
      for (const [key, value] of Object.entries(result)) {
        debugContent += `${key}:\n${value}\n\n`;
      }
      writefile(debugFile, debugContent);
      if (result.vouchers && result.vouchers.length) {
        console.log('Vouchers:', result.vouchers);
      }
      stopWorker();
    })
    .catch((err) => {
      console.error('Error:', err.message || err);
      process.exit(2);
    });
}
