import axios from 'axios';
import fs from 'fs-extra';
import tesseract from 'node-tesseract-ocr';
import path from 'path';
import { cropImageVariants } from './image_utils.js';

/**
 * Recognize text from an image file or URL using Tesseract OCR.
 * @param {string} imagePathOrUrl - Path to the image file or image URL.
 * @param {import('node-tesseract-ocr').Config} config - Tesseract OCR configuration options.
 * @returns {Promise<string>} Promise resolving to the recognized text.
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

  let imagePath = imagePathOrUrl;
  let tempFile = null;

  // Check if imagePathOrUrl is a URL
  if (/^https?:\/\//i.test(imagePathOrUrl)) {
    // Get unique file path for this URL
    const ext = path.extname(imagePathOrUrl).split('?')[0] || '.img';
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha1').update(imagePathOrUrl).digest('hex');
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    tempFile = path.join(tmpDir, `${hash}${ext}`);

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

    imagePath = tempFile;
  }

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
