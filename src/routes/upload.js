import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { ocrQueue } from '../ocr/ocrQueue.js';

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

export function uploadRoute(app) {
  // Accept both "frame" (from live camera) and "image" (manual upload)
  app.post('/upload', upload.single('frame'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No image file uploaded.');
      }

      const imagePath = req.file.path;
      // console.log('Queueing uploaded frame:', imagePath);

      // Add OCR job to the queue
      const job = await ocrQueue.add({ imagePath });

      // Wait for job completion and respond (fully async/await)
      const result = await job.finished();
      res.json({
        ...result,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error('OCR Error:', error);
      res.status(500).send('Error processing the image.');
    }
  });
}
