import path from 'path';

/**
 * Serves the main HTML page.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function indexFO(req, res) {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
}

/**
 * Serves the main HTML page.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function liveFO(req, res) {
  res.sendFile(path.join(process.cwd(), 'public', 'live.html'));
}
