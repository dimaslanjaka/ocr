import sys
import os
import pytesseract
from PIL import Image
from proxy_hunter import write_file
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from src.ocr.image_utils import dewarp_image
from src.database.VoucherDatabase import extract_voucher_codes, get_database_instance, safe_print, store_voucher_in_database
from src.utils.file import get_relative_path

def extract_text_from_image(image_path, lang='eng'):
    """
    Extract text from an image using Tesseract OCR.
    :param image_path: Path to the image file.
    :param lang: Language code for Tesseract (default: 'eng').
    :return: Extracted text as a string.
    """
    img = Image.open(image_path)
    original_tesseract = pytesseract.image_to_string(img, lang=lang)
    # Save original OCR result
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    tmp_dir = get_relative_path("tmp/ocr_results")
    os.makedirs(tmp_dir, exist_ok=True)
    original_txt_path = os.path.join(tmp_dir, f"{base_name}_original.txt")
    write_file(original_txt_path, original_tesseract)
    # Dewarping
    dewarped_result = dewarp_image(image_path)
    if dewarped_result is not None:
        dewarped_img = dewarped_result[0]  # Get the PIL image
        dewarped_tesseract = pytesseract.image_to_string(dewarped_img, lang=lang)
        # Save dewarped OCR result
        dewarped_txt_path = get_relative_path(tmp_dir, f"{base_name}_dewarped.txt")
        write_file(dewarped_txt_path, dewarped_tesseract)
        # Merge original and dewarped results, removing duplicates and preserving order
        merged = original_tesseract.splitlines() + dewarped_tesseract.splitlines()
        merged = list(dict.fromkeys([line.strip() for line in merged if line.strip()]))
        return "\n".join(merged)
    return original_tesseract

def split_and_extract_text_from_image(image_path: str) -> str:
    """
    Split the image into quarters and extract text from each part.
    :param image_path: Path to the image file.
    :return: Extracted text from all parts.
    """
    img = Image.open(image_path)
    dewarped_result = dewarp_image(image_path)
    if dewarped_result is not None:
        img = dewarped_result[0]  # Get the PIL image
    else:
        safe_print("❌\tDewarping failed, using original image.")
    width, height = img.size
    halves = [
        img.crop((0, 0, width // 2, height)),        # Left half
        img.crop((width // 2, 0, width, height))     # Right half
    ]

    all_text = []
    for i, half in enumerate(halves):
        half_path = get_relative_path("tmp/split", f"half_{i}.png")
        os.makedirs(os.path.dirname(half_path), exist_ok=True)
        half.save(half_path)
        text = pytesseract.image_to_string(half, lang="eng")
        if text:
            all_text.append(text)

    return "\n".join(all_text)

if __name__ == "__main__":
    voucher_path = "test/fixtures/voucher - normalized rotation.jpeg"
    extract = split_and_extract_text_from_image(voucher_path)
    result = extract_voucher_codes(extract)
    try:
        db_helper = get_database_instance()
        safe_print("✅\tDatabase initialized successfully")
    except Exception as e:
        safe_print(f"❌\tError initializing database: {str(e)}")
    if result:
        for code in result:
            # safe_print(f"📜\tFound voucher code: {code}")
            store_voucher_in_database(db_helper, code, voucher_path)
