import multer from 'multer';
import fs from 'fs-extra';
import { recognizeImage } from '../ocr/tesseract.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
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
  app.post('/upload', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No image file uploaded.');
      }

      const imagePath = req.file.path;
      console.log('Processing uploaded file:', imagePath);

      try {
        const text = await recognizeImage(imagePath, config);
        console.log('OCR Result:', text);

        res.json({
          text: text,
          filename: req.file.originalname
        });
      } catch (error) {
        console.error('OCR Error:', error.message);
        res.status(500).send('Error processing the image.');
      }
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).send('An error occurred while processing the image.');
    }
  });
}
