import sys
import os
import pytesseract
from PIL import Image
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from src.database.VoucherDatabase import extract_voucher_codes, safe_print, store_voucher_in_database
from src.database.SQLiteHelper import SQLiteHelper

def extract_text_from_image(image_path, lang='eng'):
    """
    Extract text from an image using Tesseract OCR.
    :param image_path: Path to the image file.
    :param lang: Language code for Tesseract (default: 'eng').
    :return: Extracted text as a string.
    """
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img, lang=lang)
    return text


if __name__ == "__main__":
    voucher_path = "test/fixtures/voucher - normalized rotation.jpeg"
    extract = extract_text_from_image(voucher_path)
    result = extract_voucher_codes(extract)
    try:
        db_helper = SQLiteHelper("tmp/voucher_database.sqlite")
        safe_print("✅\tDatabase initialized successfully")
    except Exception as e:
        safe_print(f"❌\tError initializing database: {str(e)}")
    if result:
        for code in result:
            safe_print(f"📜\tFound voucher code: {code}")
            store_voucher_in_database(db_helper, code, voucher_path)