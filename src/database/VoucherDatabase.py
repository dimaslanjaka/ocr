import sys
import os
import re
from typing import List
from .SQLiteHelper import SQLiteHelper

# Banned voucher codes (normalized, no spaces)
BANNED_VOUCHERS = {
    '1234123412341234'
}

def extract_voucher_codes(text: str) -> List[str]:
    """Extract voucher codes from the given text."""
    # Simple regex to find alphanumeric codes, adjust as needed for your voucher format
    regex = r'\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b'
    codes = re.findall(regex, text)
    # Normalize: remove all spaces, ensure 16 digits, skip banned vouchers
    normalized_codes = [
        re.sub(r'\s+', '', code)
        for code in codes
        if len(re.sub(r'\s+', '', code)) == 16 and re.sub(r'\s+', '', code) not in BANNED_VOUCHERS
    ]
    # Remove duplicates while preserving order
    seen = set()
    unique_codes = []
    for code in normalized_codes:
        if code not in seen:
            seen.add(code)
            unique_codes.append(code)
    return unique_codes

def safe_print(message, file=sys.stderr):
    """Safely print messages, handling encoding issues"""
    try:
        print(message, file=file)
        file.flush()
    except UnicodeEncodeError:
        # Fallback to ASCII if Unicode fails
        print(message.encode('ascii', 'ignore').decode('ascii'), file=file)
        file.flush()

def normalize_path(path: str) -> str:
    """Normalize path to Unix-style for consistent database storage"""
    if path:
        return os.path.normpath(path).replace('\\', '/')
    return path

def load_vouchers_from_database(db_helper: SQLiteHelper, image_path: str) -> list:
    """Load vouchers from database

    Args:
        db_helper: SQLiteHelper instance
        image_path: Path to filter by specific image

    Returns:
        List of voucher records with parsed codes
    """
    try:
        # Ensure vouchers table exists
        db_helper.create_table('vouchers', [
            'image_path TEXT PRIMARY KEY',
            'codes TEXT NOT NULL',
            'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
        ])

        # Normalize the image path for consistent lookup
        normalized_path = normalize_path(image_path)
        records = db_helper.select('vouchers',
                                 where='image_path = ?',
                                 params=(normalized_path,))

        # Parse the comma-separated codes into lists
        vouchers = []
        for record in records:
            # Normalize codes: remove spaces, ensure 16 digits
            codes = [re.sub(r'\s+', '', code) for code in record['codes'].split(',') if len(re.sub(r'\s+', '', code)) == 16]
            voucher_entry = {
                'image_path': record['image_path'],
                'codes': codes,
                'created_at': record['created_at']
            }
            vouchers.append(voucher_entry)

        safe_print(f"📖\tLoaded {len(vouchers)} voucher record(s) from database")
        return vouchers

    except Exception as e:
        safe_print(f"❌\tError loading vouchers from database: {str(e)}")
        return []

def store_voucher_in_database(db_helper: SQLiteHelper, voucher_code: str, image_path: str) -> None:
    """Save found voucher to database"""
    try:
        normalized_path = normalize_path(image_path)
        # Normalize voucher code: remove spaces, ensure 16 digits
        normalized_code = re.sub(r'\s+', '', voucher_code)
        if len(normalized_code) != 16:
            safe_print(f"⚠️\tVoucher code '{voucher_code}' is not 16 digits after normalization, skipping")
            return
        if normalized_code in BANNED_VOUCHERS:
            safe_print(f"⛔\tVoucher code '{normalized_code}' is banned, skipping")
            return

        db_helper.create_table('vouchers', [
            'image_path TEXT PRIMARY KEY',
            'codes TEXT NOT NULL',
            'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
        ])

        existing = db_helper.select('vouchers',
                                  where='image_path = ?',
                                  params=(normalized_path,))

        if existing:
            current_codes = existing[0]['codes']
            # Normalize all existing codes for comparison
            existing_codes = [re.sub(r'\s+', '', code) for code in current_codes.split(',')]
            if normalized_code not in existing_codes:
                updated_codes = f"{current_codes}, {normalized_code}" if current_codes else normalized_code
                db_helper.update('vouchers',
                               {'codes': updated_codes},
                               'image_path = ?',
                               (normalized_path,))
                safe_print(f"📝\tUpdated voucher record with {normalized_code}")
            else:
                safe_print(f"⚠️\tVoucher {normalized_code} already exists for this image, skipping")
        else:
            voucher_data = {
                'image_path': normalized_path,
                'codes': normalized_code
            }
            db_helper.insert('vouchers', voucher_data)
            safe_print(f"💾\tSaved voucher {normalized_code} to database")

    except Exception as e:
        safe_print(f"❌\tError saving voucher to database: {str(e)}")
