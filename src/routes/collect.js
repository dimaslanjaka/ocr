/**
 * Express router for handling the root route and serving the index.html file.
 * @module routes/collect
 */

import Queue from 'bull';
import express from 'express';
import path from 'path';
import JsonDB from '../database/jsonDb.js';

const router = express.Router();

// Create a Bull queue for glob jobs
const dbQueue = new Queue('collect-queue', {
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
  const db = new JsonDB(dbDir);
  const results = [];
  for await (const arr of db.loadAllStream()) {
    results.push(arr);
  }
  return results.flat();
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
