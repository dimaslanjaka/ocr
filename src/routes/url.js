import { recognizeImage } from '../ocr/tesseract.js';

// Tesseract configuration
const config = {
  lang: 'eng', // Language of OCR
  oem: 1, // OCR Engine mode
  psm: 3 // Page segmentation mode
};
/**
 * Handles OCR for an image URL provided via query string.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function urlOcrRoute(req, res) {
  const imageUrl = req.query?.imageurl;
  console.log(imageUrl);

  try {
    const text = await recognizeImage(imageUrl, config);
    console.log('OCR Result:', text);
    res.send(text);
  } catch (error) {
    console.error('OCR Error:', error.message);
    res.status(500).send('Error processing the image.');
  }
}
