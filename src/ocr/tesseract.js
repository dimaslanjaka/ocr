import axios from 'axios';
import { spawnAsync } from 'cross-spawn';
import fs from 'fs-extra';
import tesseract from 'node-tesseract-ocr';
import path from 'path';
import Tesseract, { createWorker } from 'tesseract.js';
import { cropImageVariants } from './image_utils.js';

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
export async function setupWorker() {
  if (!worker) {
    worker = await createWorker(
      ['eng', 'ind'],
      Tesseract.OEM.TESSERACT_LSTM_COMBINED,
      { cachePath: path.join(process.cwd(), 'tessdata') },
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
export async function stopWorker(exit = false, exitCode = 0) {
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
 * Returns the shared Tesseract.js worker instance.
 * Throws an error if the worker is not initialized (call setupWorker() first).
 *
 * @returns {Promise<import('tesseract.js').Worker>} The initialized Tesseract.js worker instance.
 * @throws {Error} If the worker is not initialized.
 */
export async function getWorker() {
  if (!worker) {
    await setupWorker();
  }
  return worker;
}

/**
 * Recognizes text from an image file or URL using a shared Tesseract.js worker, with optional image cropping and processed image outputs.
 *
 * - Downloads the image if a URL is provided.
 * - Optionally crops the image into variants and performs OCR on each.
 * - If `imageGrey`, `imageColor`, or `imageBinary` are enabled, saves and OCRs each processed image type separately for each variant and the original image.
 * - Returns an object mapping each variant and processed image type to its recognized text.
 *
 * @async
 * @param {string} imagePathOrUrl Path to the image file or image URL.
 * @param {Object} options Options for OCR processing.
 * @param {string} [options.outputDir] Directory to store cropped/processed image variants (default: 'tmp/tesseract').
 * @param {boolean} [options.split=false] Whether to crop the image into variants and OCR each one.
 * @param {boolean} [options.imageGrey=false] Whether to process and OCR the greyscale image output.
 * @param {boolean} [options.imageColor=false] Whether to process and OCR the color image output.
 * @param {boolean} [options.imageBinary=false] Whether to process and OCR the binary image output.
 * @param {boolean} [options.rotateAuto=false] Whether to enable automatic rotation detection.
 * @returns {Promise<Record<string, string>>} Resolves to an object mapping variant names and processed image types to recognized text.
 */
export async function recognizeImage2(imagePathOrUrl, options) {
  // Extract image if URL, otherwise return local path
  let imagePath = await getImagePathFromUrlOrLocal(imagePathOrUrl);
  const {
    outputDir = path.join(process.cwd(), 'tmp/tesseract'),
    split = false,
    imageGrey = false,
    imageColor = false,
    imageBinary = false,
    rotateAuto = false
  } = options;
  const texts = {};
  const workerInstance = await getWorker();
  /**
   * Recognize text from an image using the Tesseract worker instance.
   * @param {import('tesseract.js').ImageLike} image
   */
  const workerImpl = async (image) => {
    const result = await workerInstance.recognize(
      image,
      { rotateAuto: rotateAuto },
      { imageColor: imageColor, imageGrey: imageGrey, imageBinary: imageBinary }
    );
    return result.data;
  };

  /**
   * Converts a base64-encoded image string (data URL) to a Uint8Array for saving to disk.
   *
   * @param {string} imageSrc - The base64-encoded image string (data URL, e.g. 'data:image/png;base64,...').
   * @returns {Uint8Array} The decoded image data as a Uint8Array.
   */
  const convertImage = (imageSrc) => {
    const data = atob(imageSrc.split(',')[1])
      .split('')
      .map((c) => c.charCodeAt(0));

    return new Uint8Array(data);
  };

  if (split) {
    const cropVariants = await cropImageVariants(imagePath, outputDir);
    for (const variant of cropVariants) {
      const result = await workerImpl(variant.outputPath);
      texts[variant.name] = result.text;
      // Re-process imageGrey, imageColor, imageBinary if needed
      if (imageGrey || imageColor || imageBinary) {
        // Save each available processed image type separately
        if (result.imageGrey) {
          const imageData = convertImage(result.imageGrey);
          const outputPath = path.join(outputDir, `${variant.name}-grey.png`);
          await fs.writeFile(outputPath, imageData);
          texts[`${variant.name}-grey`] = (await workerImpl(outputPath)).text;
        }
        if (result.imageColor) {
          const imageData = convertImage(result.imageColor);
          const outputPath = path.join(outputDir, `${variant.name}-color.png`);
          await fs.writeFile(outputPath, imageData);
          texts[`${variant.name}-color`] = (await workerImpl(outputPath)).text;
        }
        if (result.imageBinary) {
          const imageData = convertImage(result.imageBinary);
          const outputPath = path.join(outputDir, `${variant.name}-binary.png`);
          await fs.writeFile(outputPath, imageData);
          texts[`${variant.name}-binary`] = (await workerImpl(outputPath)).text;
        }
      }
    }
  }

  const result = await workerImpl(imagePath);
  texts[imagePath] = result.text;
  // Re-process imageGrey, imageColor, imageBinary if needed
  if (imageGrey || imageColor || imageBinary) {
    if (result.imageGrey) {
      const imageData = convertImage(result.imageGrey);
      const outputPath = path.join(outputDir, 'original-grey.png');
      await fs.writeFile(outputPath, imageData);
      texts['original-grey'] = (await workerImpl(outputPath)).text;
    }
    if (result.imageColor) {
      const imageData = convertImage(result.imageColor);
      const outputPath = path.join(outputDir, 'original-color.png');
      await fs.writeFile(outputPath, imageData);
      texts['original-color'] = (await workerImpl(outputPath)).text;
    }
    if (result.imageBinary) {
      const imageData = convertImage(result.imageBinary);
      const outputPath = path.join(outputDir, 'original-binary.png');
      await fs.writeFile(outputPath, imageData);
      texts['original-binary'] = (await workerImpl(outputPath)).text;
    }
  }

  return texts;
}

/**
 * Recognize text from an image file or URL using Tesseract OCR and image cropping variants.
 * Downloads the image if a URL is provided, applies cropping, and merges OCR results.
 *
 * @param {string} imagePathOrUrl - Path to the image file or image URL.
 * @param {import('node-tesseract-ocr').Config} [config] - Optional Tesseract OCR configuration options.
 * @returns {Promise<string>} Promise resolving to the recognized text with duplicate lines removed.
 */
export async function recognizeImage(imagePathOrUrl, config) {
  /**
   * @type {import('node-tesseract-ocr').Config}
   */
  const defaultConfig = {
    lang: 'eng', // Language of OCR
    oem: 1, // OCR Engine mode
    psm: 3 // Page segmentation mode
  };

  // Extract image if URL, otherwise return local path
  const imagePath = await getImagePathFromUrlOrLocal(imagePathOrUrl);

  const allText = [];
  const cropped = await cropImageVariants(imagePath);

  for (const crop of cropped) {
    const text = await tesseract.recognize(crop.outputPath, { ...defaultConfig, ...config });
    allText.push(text);
  }

  const mergedText = allText.join('\n\n');
  // Remove duplicate lines and return
  const uniqueLines = Array.from(new Set(mergedText.split(/\r?\n/))).join('\n');
  return uniqueLines;
}

/**
 * Download image from URL if needed, or return local path.
 * @param {string} imagePathOrUrl
 * @returns {Promise<string>} Local file path to image
 */
export async function getImagePathFromUrlOrLocal(imagePathOrUrl) {
  if (!/^https?:\/\//i.test(imagePathOrUrl)) {
    return imagePathOrUrl;
  }
  // Get unique file path for this URL
  const ext = path.extname(imagePathOrUrl).split('?')[0] || '.img';
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha1').update(imagePathOrUrl).digest('hex');
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const tempFile = path.join(tmpDir, `${hash}${ext}`);

  let shouldDownload = true;
  let remoteSize = null;

  // Try to get remote file size
  try {
    const headResp = await axios.head(imagePathOrUrl);
    if (headResp.headers['content-length']) {
      remoteSize = parseInt(headResp.headers['content-length'], 10);
    }
  } catch {
    // ignore HEAD errors, fallback to always download
  }

  // If local file exists and remote size is known, compare sizes
  try {
    const stat = await fs.stat(tempFile);
    if (remoteSize !== null && stat.size === remoteSize) {
      shouldDownload = false;
    }
  } catch {
    // file does not exist, should download
  }

  if (shouldDownload) {
    const response = await axios.get(imagePathOrUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(tempFile, response.data);
  }

  return tempFile;
}

/**
 * Recognize text from an image file or URL using a Python script (focus_pytesseract.py).
 *
 * @param {string} imagePathOrUrl - Path to the image file or image URL.
 * @returns {Promise<string>} Promise resolving to the recognized text from Python OCR.
 * @throws {Error} If the Python OCR process fails.
 */
export async function recognizeImagePython(imagePathOrUrl) {
  const scriptPath = path.join(process.cwd(), 'src/ocr/focus_pytesseract.py');
  const args = [scriptPath, '-f', imagePathOrUrl];
  const result = await spawnAsync(getPythonExecutable(), args, { stdio: 'pipe' });
  if (result.error) {
    throw new Error(`Python OCR failed: ${result.error.message}`);
  }
  return result.output.toString().trim();
}

/**
 * Get the path to the Python executable, preferring local virtual environments if available.
 *
 * @returns {string} Path to the Python executable (absolute or just 'python'/'python3').
 */
function getPythonExecutable() {
  const isWindows = process.platform === 'win32';
  let pythonName = isWindows ? 'python' : 'python3';
  if (isWindows) pythonName += '.exe';
  const pythonPaths = [
    path.join(process.cwd(), '.venv', 'Scripts', pythonName),
    path.join(process.cwd(), 'venv', 'Scripts', pythonName)
  ];
  for (const pythonPath of pythonPaths) {
    if (fs.existsSync(pythonPath)) {
      return pythonPath;
    }
  }
  return pythonName; // Fallback to just 'python' or 'python3'
}
