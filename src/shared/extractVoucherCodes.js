// Shared extractVoucherCodes for browser and server

import { BANNED_VOUCHERS } from './bannedVouchers.js';

/**
 * Extract voucher codes from the given text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractVoucherCodes(text, { filterBanned = false } = {}) {
  // Simple regex to find alphanumeric codes, adjust as needed for your voucher format
  const regex = /\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/g;
  const matches = text.match(regex) || [];
  // Normalize: remove all spaces, ensure 16 digits, remove duplicates
  const seen = new Set();
  let codes = matches
    .map((code) => code.replace(/\s+/g, ''))
    .filter((code) => {
      if (code.length !== 16 || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
  if (filterBanned) {
    codes = codes.filter((code) => !BANNED_VOUCHERS.has(code));
  }
  return codes;
}
