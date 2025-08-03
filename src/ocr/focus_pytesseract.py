import sys
import os
import pytesseract
from PIL import Image
import cv2
import numpy as np
import argparse
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


def preprocess_image_for_ocr(image_path: str) -> Image.Image:
    """
    Preprocess the image for better OCR results.
    Steps: Upscale, grayscale, contrast, sharpening, thresholding, noise removal.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not load image at path: {image_path}")

    # Upscale image for better OCR (2x)
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Increase contrast using histogram equalization
    gray = cv2.equalizeHist(gray)

    # Sharpen image
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp = cv2.filter2D(gray, -1, kernel)

    # Try Otsu's thresholding
    _, thresh = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Remove noise
    denoised = cv2.medianBlur(thresh, 3)

    # Convert back to PIL Image
    pil_img = Image.fromarray(denoised)
    return pil_img


def focus_extract_text_from_image(image_path: str) -> str:
    """
    Split the image into halves and extract text from each part.
    :param image_path: Path to the image file.
    :return: Extracted text from all parts.
    """
    # img = preprocess_image_for_ocr(image_path)
    # img = Image.open(image_path)
    dewarp_result = dewarp_image(image_path)
    if dewarp_result is None:
        raise ValueError(f"dewarp_image returned None for image: {image_path}")
    if isinstance(dewarp_result, tuple):
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
        default=get_relative_path("test/fixtures/voucher - normalized rotation.jpeg"),
        help="Path to the voucher image file (default: test/fixtures/voucher - normalized rotation.jpeg)",
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
