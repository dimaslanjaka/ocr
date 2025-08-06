import { spawnAsync } from 'cross-spawn';

spawnAsync('node', ['src/ocr/cli.js', 'test/fixtures/voucher.jpeg'], { stdio: 'pipe' })
  .then((result) => {
    console.log('OCR Result:', result);
  })
  .catch((err) => {
    console.error('Error during OCR:', err);
  });
