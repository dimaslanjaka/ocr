import sys
import os
import re
import json
import hashlib
from typing import Any, List, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from .SQLiteHelper import SQLiteHelper
from src.database.jsonDb import JsonDB
from ..utils.file import get_relative_path

def get_database_instance() -> SQLiteHelper:
    """Get or create a singleton instance of the SQLiteHelper for the voucher database."""
    if not hasattr(get_database_instance, "_instance") or get_database_instance._db_path != get_relative_path("tmp/voucher_database.sqlite"):
        get_database_instance._instance = SQLiteHelper(get_relative_path("tmp/voucher_database.sqlite"))
        get_database_instance._db_path = get_relative_path("tmp/voucher_database.sqlite")
    return get_database_instance._instance

# Banned voucher codes (normalized, no spaces)
BANNED_VOUCHERS = {
    '1234123412341234'
}

def md5(text: str) -> str:
    """Generate MD5 hash for a given string."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def extract_voucher_codes(text: str, output_dir: Optional[str] = None) -> List[str]:
    """
    Extract voucher codes from the given text, optionally outputting debug info to output_dir.
    """
    # Simple regex to find numeric voucher codes
    regex = r"\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b"
    matches = re.findall(regex, text) or []

    # Normalize, filter, and deduplicate
    seen = set()
    result = []
    for code in matches:
        normalized = re.sub(r"\s+", "", code)
        if len(normalized) != 16 or normalized in BANNED_VOUCHERS or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)

    # Debug file writing if requested
    if output_dir:
        try:
            os.makedirs(output_dir, exist_ok=True)
            filename_hash = md5(text)
            with open(os.path.join(output_dir, f"{filename_hash}_text.txt"), "w", encoding="utf-8") as f:
                f.write(text)
            with open(os.path.join(output_dir, f"{filename_hash}_regex.txt"), "w", encoding="utf-8") as f:
                f.write(regex)
            with open(os.path.join(output_dir, f"{filename_hash}_result.json"), "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        except Exception as e:
            safe_print(f"❌\tError writing debug files: {e}", True)

    return result

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

def storeVoucherJson(voucherCode: str, imagePath: str) -> None:
    """
    Store a voucher code as JSON for a given image path.
    :param voucherCode: The voucher code to store.
    :param imagePath: The image path associated with the voucher.
    """
    db = JsonDB(os.path.join(os.getcwd(), "tmp", "vouchers"))

    try:
        vouchers = db.load(imagePath) or []
        if not isinstance(vouchers, list):
            vouchers = []
    except FileNotFoundError:
        vouchers = []

    vouchers.append(voucherCode)

    # Ensure no duplicates and normalize
    uniqueVouchers = list({
        re.sub(r"\s+", "", v).strip()
        for v in vouchers
    })

    # Filter out banned vouchers and ensure valid length
    filteredVouchers = [
        v for v in uniqueVouchers
        if len(v) == 16 and v not in BANNED_VOUCHERS
    ]

    if not filteredVouchers:
        safe_print(f"⚠️\tNo valid vouchers to store for {imagePath}")
        return

    db.save(imagePath, filteredVouchers)


def loadVoucherJson(imagePath: str) -> Optional[Any]:
    """
    Load a voucher code JSON for a given image path.
    :param imagePath: The image path to load the voucher for.
    :return: The loaded voucher list or None if not found or error.
    """
    db = JsonDB(os.path.join(os.getcwd(), "tmp", "vouchers"))

    try:
        return db.load(imagePath)
    except Exception as e:
        print(f"❌\tError loading voucher JSON: {str(e)}", flush=True)
        return None
