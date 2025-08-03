import path from 'path';
import Tesseract from 'tesseract.js';
import { splitImage } from './split-image.js';
import { optimizeForOCR } from './optimize-image.js';

(async () => {
  const inputPath = path.join(process.cwd(), 'test', 'fixtures', 'voucher - normalized rotation.jpeg');
  const outputDir = path.join(process.cwd(), 'tmp');
  const split = await splitImage(inputPath, outputDir);

  console.log('Split result:', split);

  if (!Array.isArray(split)) {
    console.error('splitImage did not return an array:', split);
    return;
  }

  for (const part of split) {
    console.log(`Processing ${part}`);
    const optimizedPath = path.join(outputDir, 'optimized-' + path.basename(part, path.extname(part)) + '.png');
    const optimize = await optimizeForOCR(part, optimizedPath);
    const result = await Tesseract.recognize(optimize, 'ind');
    console.log(optimize, result.data.text);
  }
})();
