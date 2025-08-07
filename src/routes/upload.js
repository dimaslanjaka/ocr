import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { ocrQueue } from '../ocr/ocrQueue.js';
import { getUniqueUserId } from '../utils/express-utils.js';

const router = express.Router();

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

// POST /upload
router.post(
  '/',
  async (req, res, next) => {
    const isJson = req.is('application/json');
    const isUrlEncoded = req.is('application/x-www-form-urlencoded');
    const imageUrl = req.body && req.body.imageUrl;
    if ((isJson || isUrlEncoded) && imageUrl) {
      try {
        if (!imageUrl) {
          return res.status(400).send('No imageUrl provided.');
        }
        const userId = getUniqueUserId(req);
        const job = await ocrQueue.add(userId, { imageUrl });
        res.json({ jobId: job.id });
      } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).send('Error processing the image URL.');
      }
    } else {
      next();
    }
  },
  upload.fields([
    { name: 'frame', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const file = (req.files && (req.files['frame']?.[0] || req.files['image']?.[0])) || null;
      if (!file) {
        return res.status(400).send('No image file uploaded.');
      }
      const imagePath = file.path;
      const job = await ocrQueue.add({ imagePath });
      res.json({
        jobId: job.id,
        filename: file.originalname
      });
    } catch (error) {
      console.error('OCR Error:', error);
      res.status(500).send('Error processing the image.');
    }
  }
);

// GET /result/:jobId
router.get('/result/:jobId', async (req, res) => {
  try {
    const job = await ocrQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ status: 'not_found' });
    const state = await job.getState();
    if (state === 'completed') {
      return res.json({ status: 'completed', result: job.returnvalue });
    } else if (state === 'failed') {
      return res.json({ status: 'failed', error: job.failedReason });
    } else {
      return res.json({ status: 'pending' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

export default router;
export { router as uploadRoute };
