import { md5 } from 'sbg-utility';

/**
 * Generates a unique user ID based on the request's user-agent and IP address.
 *
 * @param {import('express').Request} req - The Express request object
 * @returns {string} A unique user identifier (MD5 hash)
 */
export function getUniqueUserId(req) {
  // Extract userId from request
  const useragent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = md5(`${useragent}-${ip}`);
  const build = [
    userId.charAt(0),
    userId.charAt(Math.floor(userId.length / 2) - 1),
    userId.charAt(Math.floor(userId.length / 2)),
    userId.charAt(userId.length - 2),
    userId.charAt(userId.length - 1)
  ];
  return build.join('');
}
