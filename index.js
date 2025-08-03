import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { bin, install } from 'cloudflared';
import { recognizeImage } from './src/ocr/tesseract.js';

const app = express();

const cfCallback = () => {
  const cloudflaredToken = process.env.CLOUDFLARED_TOKEN;

  if (!cloudflaredToken) {
    console.error('CLOUDFLARED_TOKEN environment variable is not set');
    return;
  }

  console.log('Starting cloudflared tunnel...');
  const cloudflared = spawn(bin, ['tunnel', '--no-autoupdate', 'run', '--token', cloudflaredToken], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  cloudflared.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Cloudflared:', output.trim());

    // Capture tunnel URL if available
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (urlMatch) {
      console.log('🌐 Tunnel URL:', urlMatch[0]);
    }
  });

  cloudflared.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('Cloudflared Info:', output.trim());

    // Look for hostname configuration
    if (output.includes('hostname')) {
      const hostnameMatch = output.match(/"hostname":"([^"]+)"/);
      if (hostnameMatch) {
        console.log('🌐 Tunnel accessible at: https://' + hostnameMatch[1]);
      }
    }
  });

  cloudflared.on('close', (code) => {
    console.log(`cloudflared closed with code ${code}`);
  });

  cloudflared.on('exit', (code, signal) => {
    console.log(`cloudflared exited with code ${code} & signal ${signal}`);
  });

  cloudflared.on('error', (err) => {
    console.error('Failed to start cloudflared:', err);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down cloudflared...');
    cloudflared.kill('SIGTERM');
    process.exit(0);
  });
};

const startCloudflared = () => {
  if (!fs.existsSync(bin)) {
    console.log('Installing cloudflared binary...');
    install(bin)
      .then(() => {
        console.log('Cloudflared binary installed successfully');
        cfCallback();
      })
      .catch((err) => {
        console.error('Error installing cloudflared:', err);
      });
  } else {
    console.log('Using existing cloudflared binary');
    cfCallback();
  }
};

// Middleware to serve static files and parse form data
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

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

const PORT = 8080; // Changed to match cloudflared config

// Tesseract configuration
const config = {
  lang: 'eng', // Language of OCR
  oem: 1, // OCR Engine mode
  psm: 3 // Page segmentation mode
};

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'index.html'));
});

// Route to fetch and convert the image
app.get('/url', async (req, res) => {
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
});

// Route to upload and process image file
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

      // Clean up uploaded file after processing
      await fs.promises.unlink(imagePath);

      res.json({
        text: text,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error('OCR Error:', error.message);

      // Clean up uploaded file on error
      await fs.promises.unlink(imagePath).catch((err) => {
        if (err) console.error('Error deleting file:', err);
      });

      res.status(500).send('Error processing the image.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('An error occurred while processing the image.');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('🚀 Starting cloudflared tunnel...');

  // Start cloudflared after server is ready
  startCloudflared();
});
