/**
 * Returns the base URL for the OCR API endpoint.
 *
 * - In a browser environment, uses the current window location's origin.
 * - In a Node.js environment, constructs the URL from HOST and PORT environment variables (defaults to localhost:3000).
 * - Always appends '/ocr' to the base URL and removes any trailing slash before it.
 *
 * @returns {string} The base URL ending with '/ocr'.
 */
export function getBaseUrl() {
  let origin;
  if (typeof window !== 'undefined') {
    origin = window.location.origin;
  } else {
    origin = `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`;
  }
  if (origin.includes('tunnel.webmanajemen.com')) {
    // Local development tunnel URL
    return origin.replace(/\/$/, '');
  }
  return origin.replace(/\/$/, '') + '/ocr';
}
