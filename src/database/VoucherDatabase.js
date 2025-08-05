import path from 'path';
import fs from 'fs-extra';
import JsonDB from './jsonDb.js';

// Banned voucher codes (normalized, no spaces)
const BANNED_VOUCHERS = new Set(['1234123412341234', '1234123422341234']);

/**
 * Extract voucher codes from the given text, optionally outputting debug info to outputDir.
 * @param {string} text
 * @param {string} [outputDir] - Optional directory to write debug files (text, regex, result)
 * @returns {string[]}
 */
export function extractVoucherCodes(text, outputDir) {
  // Simple regex to find alphanumeric codes, adjust as needed for your voucher format
  const regex = /\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/g;
  const matches = text.match(regex) || [];
  // Normalize: remove all spaces, ensure 16 digits, skip banned vouchers, remove duplicates
  const seen = new Set();
  const result = matches
    .map((code) => code.replace(/\s+/g, ''))
    .filter((code) => {
      if (code.length !== 16 || BANNED_VOUCHERS.has(code) || seen.has(code)) return false;
      seen.add(code);
      return true;
    });

  if (outputDir) {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(path.join(outputDir, 'debug_text.txt'), text, 'utf8');
      fs.writeFileSync(path.join(outputDir, 'debug_regex.txt'), regex.toString(), 'utf8');
      fs.writeFileSync(path.join(outputDir, 'debug_result.json'), JSON.stringify(result, null, 2), 'utf8');
    } catch (e) {
      // Don't throw, just print error
      safePrint(`❌\tError writing debug files: ${e.message}`, true);
    }
  }
  return result;
}

export function safePrint(message, isError = false) {
  try {
    if (isError) {
      process.stderr.write(message + '\n');
    } else {
      process.stdout.write(message + '\n');
    }
  } catch {
    // Fallback to ASCII if Unicode fails
    // eslint-disable-next-line no-control-regex
    const asciiMsg = message.replace(/[^\u0001-\u007F]/g, '');
    if (isError) {
      process.stderr.write(asciiMsg + '\n');
    } else {
      process.stdout.write(asciiMsg + '\n');
    }
  }
}

export function normalizePath(p) {
  if (p) {
    return path.normalize(p).replace(/\\/g, '/');
  }
  return p;
}

/**
 * Load vouchers from database
 * @param {import('./SQLiteHelper.js').default} dbHelper
 * @param {string} imagePath
 * @returns {Promise<Array>}
 */
export async function loadVouchersFromDatabase(dbHelper, imagePath) {
  try {
    // Ensure vouchers table exists
    dbHelper.createTable('vouchers', [
      'image_path TEXT PRIMARY KEY',
      'codes TEXT NOT NULL',
      'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ]);

    const normalizedPath = normalizePath(imagePath);
    const records = dbHelper.select('vouchers', {
      where: 'image_path = ?',
      params: [normalizedPath]
    });

    const vouchers = [];
    for (const record of records) {
      vouchers.push({
        image_path: record.image_path,
        codes: record.codes
          .split(',')
          .map((code) => code.replace(/\s+/g, '').trim())
          .filter((code) => code.length === 16),
        created_at: record.created_at
      });
    }

    safePrint(`📖\tLoaded ${vouchers.length} voucher record(s) from database`);
    return vouchers;
  } catch (e) {
    safePrint(`❌\tError loading vouchers from database: ${e.message}`, true);
    return [];
  }
}

/**
 * Save found voucher to database
 * @param {import('./SQLiteHelper.js').default} dbHelper
 * @param {string} voucherCode
 * @param {string} imagePath
 * @returns {Promise<void>}
 */
export async function storeVoucherInDatabase(dbHelper, voucherCode, imagePath) {
  try {
    const normalizedPath = normalizePath(imagePath);
    // Normalize voucher code: remove spaces, ensure 16 digits
    const normalizedCode = voucherCode.replace(/\s+/g, '');
    if (normalizedCode.length !== 16) {
      safePrint(`⚠️\tVoucher code '${voucherCode}' is not 16 digits after normalization, skipping`);
      return;
    }
    if (BANNED_VOUCHERS.has(normalizedCode)) {
      safePrint(`⛔\tVoucher code '${normalizedCode}' is banned, skipping`);
      return;
    }

    dbHelper.createTable('vouchers', [
      'image_path TEXT PRIMARY KEY',
      'codes TEXT NOT NULL',
      'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ]);

    const existing = await dbHelper.select('vouchers', {
      where: 'image_path = ?',
      params: [normalizedPath]
    });

    if (existing && existing.length > 0) {
      const currentCodes = existing[0].codes;
      // Normalize all existing codes for comparison
      const existingCodes = currentCodes.split(',').map((c) => c.replace(/\s+/g, '').trim());
      if (!existingCodes.includes(normalizedCode)) {
        const updatedCodes = currentCodes ? `${currentCodes}, ${normalizedCode}` : normalizedCode;
        await dbHelper.update('vouchers', { codes: updatedCodes }, 'image_path = ?', [normalizedPath]);
        safePrint(`📝\tUpdated voucher record with ${normalizedCode}`);
      } else {
        safePrint(`⚠️\tVoucher ${normalizedCode} already exists for this image, skipping`);
      }
    } else {
      const voucherData = {
        image_path: normalizedPath,
        codes: normalizedCode
      };
      await dbHelper.insert('vouchers', voucherData);
      safePrint(`💾\tSaved voucher ${normalizedCode} to database`);
    }
  } catch (e) {
    safePrint(`❌\tError saving voucher to database: ${e.message}`, true);
  }
}

/**
 * Store a voucher code as JSON for a given image path.
 * @param {string} voucherCode - The voucher code to store.
 * @param {string} imagePath - The image path associated with the voucher.
 */
export function storeVoucherJson(voucherCode, imagePath) {
  const db = new JsonDB(path.join(process.cwd(), 'tmp/vouchers'));
  /**
   * @type {string[]}
   */
  const vouchers = db.load(imagePath) || [];
  vouchers.push(voucherCode);
  // Ensure no duplicates and normalize
  const uniqueVouchers = Array.from(new Set(vouchers.map((v) => v.replace(/\s+/g, '').trim())));
  // Ensure banned vouchers are not stored
  const filteredVouchers = uniqueVouchers.filter((v) => v.length === 16 && !BANNED_VOUCHERS.has(v));
  if (filteredVouchers.length === 0) {
    safePrint(`⚠️\tNo valid vouchers to store for ${imagePath}`);
    return;
  }
  db.save(imagePath, filteredVouchers);
}

/**
 * Load a voucher code JSON for a given image path.
 * @template T
 * @param {string} imagePath - The image path to load the voucher for.
 * @returns {T|null} The loaded voucher object of type T, or null if not found or error.
 */
export function loadVoucherJson(imagePath) {
  const db = new JsonDB(path.join(process.cwd(), 'tmp/vouchers'));
  try {
    return db.load(imagePath);
  } catch (e) {
    safePrint(`❌\tError loading voucher JSON: ${e.message}`, true);
    return null;
  }
}
