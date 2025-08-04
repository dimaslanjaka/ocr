import sys
import os
import pytesseract
from PIL import Image
import argparse
from pathlib import Path
from proxy_hunter import write_file

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.database.VoucherDatabase import (
    extract_voucher_codes,
    get_database_instance,
    safe_print,
    store_voucher_in_database,
)
from src.utils.file import get_relative_path
from src.ocr.image_utils import dewarp_image


def focus_extract_text_from_image(image_path: str) -> str:
    """
    Split the image into halves and extract text from each part.
    :param image_path: Path to the image file.
    :return: Extracted text from all parts.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image path does not exist: {image_path}")
    elif os.path.exists(os.path.join(os.getcwd(), image_path)):
        # fix for relative paths
        image_path = os.path.join(os.getcwd(), image_path)
    elif os.path.exists(os.path.join(Path.cwd(), image_path)):
        # fix for relative paths
        image_path = os.path.join(Path.cwd(), image_path)
    dewarp_result = dewarp_image(image_path)
    if dewarp_result is None:
        img = Image.open(image_path)
    elif isinstance(dewarp_result, tuple):
        img = dewarp_result[0]
    else:
        img = dewarp_result
    width, height = img.size
    crops = [
        ("full", img),
        ("top_half", img.crop((0, 0, width, height // 2))),
        ("bottom_half", img.crop((0, height // 2, width, height))),
        ("left_half", img.crop((0, 0, width // 2, height))),
        ("right_half", img.crop((width // 2, 0, width, height))),
    ]

    all_text = []
    for name, crop_img in crops:
        crop_path = get_relative_path("tmp/split", f"{name}.png")
        os.makedirs(os.path.dirname(crop_path), exist_ok=True)
        crop_img.save(crop_path)
        text = pytesseract.image_to_string(
            crop_img, lang="eng", config="--psm 3 --oem 1"
        )
        if text:
            all_text.append(text)
            write_file(crop_path.replace(".png", ".txt"), text)

    return "\n".join(all_text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract text from voucher images using OCR"
    )
    parser.add_argument(
        "-f",
        "--file",
        default=get_relative_path("test/fixtures/voucher-fix.jpeg"),
        help="Path to the voucher image file",
    )
    args = parser.parse_args()
    voucher_path = args.file
    extract = focus_extract_text_from_image(voucher_path)
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
