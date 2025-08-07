import 'dotenv/config';
import './src/global_shim.js';

///
import { spawn } from 'child_process';
import { bin, install } from 'cloudflared';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { collectRouter } from './src/routes/collect.js';
import { uploadRoute } from './src/routes/upload.js';
import { urlOcrRoute } from './src/routes/url.js';
import { getChecksum } from 'sbg-utility';
import { spawnAsync } from 'cross-spawn';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let broadcaster = null;
let viewers = new Set();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      console.error('Invalid WS message:', message);
      return;
    }

    switch (data.type) {
      case 'broadcaster':
        broadcaster = ws;
        ws.role = 'broadcaster';
        break;

      case 'viewer':
        viewers.add(ws);
        ws.role = 'viewer';
        if (broadcaster) {
          broadcaster.send(JSON.stringify({ type: 'viewer' }));
        }
        break;

      case 'offer':
        if (data.target === 'viewer') {
          viewers.forEach((v) => {
            if (v.readyState === ws.OPEN) v.send(JSON.stringify(data));
          });
        }
        break;

      case 'answer':
        if (broadcaster && broadcaster.readyState === ws.OPEN) {
          broadcaster.send(JSON.stringify(data));
        }
        break;

      case 'candidate':
        if (ws.role === 'broadcaster') {
          viewers.forEach((v) => {
            if (v.readyState === ws.OPEN) v.send(JSON.stringify(data));
          });
        } else if (ws.role === 'viewer') {
          if (broadcaster && broadcaster.readyState === ws.OPEN) {
            broadcaster.send(JSON.stringify(data));
          }
        }
        break;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'broadcaster') {
      broadcaster = null;
    } else if (ws.role === 'viewer') {
      viewers.delete(ws);
    }
  });
});

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

    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (urlMatch) {
      console.log('🌐 Tunnel URL:', urlMatch[0]);
    }
  });

  cloudflared.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('Cloudflared Info:', output.trim());

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

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/favicon.ico', (req, res) => {
  return res.sendFile(path.join(__dirname + '/public/favicon.ico'));
});

// Routes
app.get('/', (req, res) => {
  res.redirect('/index.html');
});
app.get('/live', (req, res) => {
  res.redirect('/live.html');
});
app.get('/url', urlOcrRoute);
app.router.use('/collect', collectRouter);
uploadRoute(app);
app.get('/build', async (req, res) => {
  // Get checksum src folder
  const srcFolder = path.join(__dirname, 'src');
  const checksum = getChecksum(srcFolder);
  const lastChecksumFile = path.join(__dirname, 'tmp/last_checksum.txt');
  const lastChecksum = fs.existsSync(lastChecksumFile) ? fs.readFileSync(lastChecksumFile, 'utf-8') : null;
  if (checksum !== lastChecksum) {
    fs.writeFileSync(lastChecksumFile, checksum);
    spawnAsync('npm', ['run', 'build'], { stdio: 'inherit', cwd: __dirname });
    console.log('New checksum generated:', checksum);
  }
  res.json({ checksum });
});

// Start server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('🚀 Starting cloudflared tunnel...');
  startCloudflared();
});
