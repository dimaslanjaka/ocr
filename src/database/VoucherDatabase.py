import sys
import os
import re
from .SQLiteHelper import SQLiteHelper

def extract_voucher_codes(text: str) -> list:
    """Extract voucher codes from the given text."""
    # Simple regex to find alphanumeric codes, adjust as needed for your voucher format
    regex = r'\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b'
    return re.findall(regex, text)

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
            voucher_entry = {
                'image_path': record['image_path'],
                'codes': [code.strip() for code in record['codes'].split(',') if code.strip()],
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
            if voucher_code not in current_codes:
                updated_codes = f"{current_codes}, {voucher_code}" if current_codes else voucher_code
                db_helper.update('vouchers',
                               {'codes': updated_codes},
                               'image_path = ?',
                               (normalized_path,))
                safe_print(f"📝\tUpdated voucher record with {voucher_code}")
            else:
                safe_print(f"⚠️\tVoucher {voucher_code} already exists for this image, skipping")
        else:
            voucher_data = {
                'image_path': normalized_path,
                'codes': voucher_code
            }
            db_helper.insert('vouchers', voucher_data)
            safe_print(f"💾\tSaved voucher {voucher_code} to database")

    except Exception as e:
        safe_print(f"❌\tError saving voucher to database: {str(e)}")
