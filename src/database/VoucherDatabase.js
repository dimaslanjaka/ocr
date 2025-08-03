import path from 'path';

/**
 * Extract voucher codes from the given text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractVoucherCodes(text) {
  // Simple regex to find alphanumeric codes, adjust as needed for your voucher format
  const regex = /\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/g;
  return text.match(regex) || [];
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
          .map((code) => code.trim())
          .filter(Boolean),
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
      if (
        !currentCodes
          .split(',')
          .map((c) => c.trim())
          .includes(voucherCode)
      ) {
        const updatedCodes = currentCodes ? `${currentCodes}, ${voucherCode}` : voucherCode;
        await dbHelper.update('vouchers', { codes: updatedCodes }, 'image_path = ?', [normalizedPath]);
        safePrint(`📝\tUpdated voucher record with ${voucherCode}`);
      } else {
        safePrint(`⚠️\tVoucher ${voucherCode} already exists for this image, skipping`);
      }
    } else {
      const voucherData = {
        image_path: normalizedPath,
        codes: voucherCode
      };
      await dbHelper.insert('vouchers', voucherData);
      safePrint(`💾\tSaved voucher ${voucherCode} to database`);
    }
  } catch (e) {
    safePrint(`❌\tError saving voucher to database: ${e.message}`, true);
  }
}
