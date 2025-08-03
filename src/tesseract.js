import tesseract from 'node-tesseract-ocr';

/**
 * Recognize text from an image file or URL using Tesseract OCR.
 * @param {string} imagePathOrUrl - Path to the image file or image URL.
 * @param {import('node-tesseract-ocr').Config} config - Tesseract OCR configuration options.
 * @returns {Promise<string>} Promise resolving to the recognized text.
 */
export function recognizeImage(imagePathOrUrl, config) {
  return tesseract.recognize(imagePathOrUrl, config);
}
