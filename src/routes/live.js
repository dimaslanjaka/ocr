import path from 'path';

/**
 * Serves the main HTML page.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export default function liveRoute(req, res) {
  res.sendFile(path.join(process.cwd(), 'views', 'live.html'));
}
