import { spawn } from 'child_process';
import { bin, install } from 'cloudflared';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import indexRoute from './src/routes/index.js';
import { uploadRoute } from './src/routes/upload.js';
import { urlOcrRoute } from './src/routes/url.js';

const app = express();
const _router = express.Router();

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

const PORT = 8080; // Changed to match cloudflared config

// Register routes
app.get('/', indexRoute);
app.get('/url', urlOcrRoute);
uploadRoute(app);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('🚀 Starting cloudflared tunnel...');

  // Start cloudflared after server is ready
  startCloudflared();
});
