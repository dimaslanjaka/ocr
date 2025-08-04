import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { recognizeImage } from '../ocr/tesseract.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'tmp/uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop();
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Tesseract configuration
const config = {
  lang: 'eng', // Language of OCR
  oem: 1, // OCR Engine mode
  psm: 3 // Page segmentation mode
};

export function uploadRoute(app) {
  // Accept both "frame" (from live camera) and "image" (manual upload)
  app.post('/upload', upload.single('frame'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No image file uploaded.');
      }

      const imagePath = req.file.path;
      console.log('Processing uploaded frame:', imagePath);

      try {
        const text = await recognizeImage(imagePath, config);
        console.log('OCR Result:', text);

        // Clean up the image file after processing
        setTimeout(() => {
          fs.rmSync(imagePath, { force: true });
        }, 5000);

        res.json({
          text: text.trim(),
          filename: req.file.originalname
        });
      } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).send('Error processing the image.');
      }
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('An error occurred while processing the image.');
    }
  });
}
