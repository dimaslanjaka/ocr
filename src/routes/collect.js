/**
 * Express router for handling the root route and serving the index.html file.
 * @module routes/collect
 */

import Queue from 'bull';
import express from 'express';
import fs from 'fs-extra';
import * as glob from 'glob';
import path from 'path';
import { jsonParseWithCircularRefs } from 'sbg-utility';

const router = express.Router();

// Create a Bull queue for glob jobs
const dbQueue = new Queue('db-queue', {
  redis: { host: '127.0.0.1', port: 6379 }
});

/**
 * Controller for the root route. Sends the index.html file as a response.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
const index = (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'collect.html'));
};

// Queue processor for glob jobs
dbQueue.process(async (job) => {
  const dbDir = job.data.dbDir;
  return new Promise((resolve, reject) => {
    const vouchers = [];
    const stream = glob.stream('**/*.json', { cwd: dbDir });

    stream.on('data', (file) => {
      try {
        const filePath = path.join(dbDir, file);
        const data = jsonParseWithCircularRefs(fs.readFileSync(filePath, 'utf-8'));
        if (data) {
          vouchers.push(data);
        }
      } catch (err) {
        // Optionally log or handle file read/parse errors
        console.error(`Error reading or parsing file ${file}:`, err);
      }
    });

    stream.on('end', () => {
      resolve(vouchers);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
});

const collector = async (req, res) => {
  const dbDir = path.join(process.cwd(), 'tmp', 'vouchers');
  try {
    const job = await dbQueue.add({ dbDir });
    const result = await job.finished();
    res.json(result);
  } catch (err) {
    console.error('Error processing voucher queue:', err);
    res.status(500).send('Error processing voucher queue');
  }
};

router.get('/', index);
router.post('/get', collector);

export { router as collectRouter };
