import argparse
import os
import re
import sys
import warnings
import easyocr
import numpy as np
from typing import TypedDict, List, Optional, Any
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.utils.file import get_relative_path
from src.database.VoucherDatabase import get_database_instance, store_voucher_in_database, safe_print, extract_voucher_codes
from src.ocr.image_utils import split_image

# Suppress PyTorch DataLoader warnings about pin_memory
warnings.filterwarnings("ignore", message=".*pin_memory.*")

class OCRResult(TypedDict, total=False):
    bbox: List[List[int]]
    text: str
    confidence: float
    section: Optional[str]

class EasyOCROptions(TypedDict, total=False):
    languages: List[str]
    reader_kwargs: dict[str, Any]
    readtext_kwargs: dict[str, Any]
    gpu: bool
    model_storage_directory: str
    user_network_directory: str
    detect_network: str
    recog_network: str
    download_enabled: bool
    detector: bool
    recognizer: bool
    verbose: bool
    quantize: bool
    cudnn_benchmark: bool

def extract_text_from_image(
    image: "str | np.ndarray | Image.Image",  # Accepts file path, numpy array, or PIL Image
    section_name: Optional[str] = None,
    easyocr_options: Optional[EasyOCROptions] = None  # Use TypedDict for options
) -> List[OCRResult]:
    """
    Extract text from a single image.

    Args:
        image: File path (str), numpy array, or PIL Image object (PIL.Image.Image).
        section_name: Optional section name for logging.
        easyocr_options: Optional EasyOCROptions for easyocr.Reader and/or readtext.

    Returns:
        List of OCRResult dictionaries.
    """
    try:
        # Prepare Reader kwargs from EasyOCROptions
        reader_kwargs = easyocr_options.get('reader_kwargs', {}).copy() if easyocr_options else {}
        # Map all supported Reader params from easyocr_options if present
        if easyocr_options:
            for k in [
                'gpu', 'model_storage_directory', 'user_network_directory', 'detect_network',
                'recog_network', 'download_enabled', 'detector', 'recognizer', 'verbose',
                'quantize', 'cudnn_benchmark'
            ]:
                if k in easyocr_options:
                    reader_kwargs[k] = easyocr_options[k]
        reader_langs = easyocr_options.get('languages', ['en']) if easyocr_options else ['en']
        reader = easyocr.Reader(reader_langs, **reader_kwargs)

        # Use options for readtext if provided
        readtext_kwargs = easyocr_options.get('readtext_kwargs', {}) if easyocr_options else {}

        if isinstance(image, str):
            # File path
            result = reader.readtext(image, **readtext_kwargs)
        else:
            # PIL Image object - convert to array
            img_array = np.array(image)
            result = reader.readtext(img_array, **readtext_kwargs)

        if section_name:
            safe_print(f"✅\tFound {len(result)} text elements in {section_name}")
        else:
            safe_print(f"✅\tFound {len(result)} text elements")

        # Format result data
        result_data = []
        for (bbox, text, conf) in result:
            item = {
                'bbox': [[int(coord) for coord in point] for point in bbox],
                'text': text,
                'confidence': float(conf)
            }
            if section_name:
                item['section'] = section_name
            result_data.append(item)

        return result_data

    except Exception as e:
        if section_name:
            safe_print(f"❌\tError reading text from {section_name}: {str(e)}")
        else:
            safe_print(f"❌\tError reading text: {str(e)}")
        return []

def main(voucher_path):
    """Main function to extract text from voucher image"""

    if not voucher_path:
        voucher_path = get_relative_path("test/fixtures/voucher-fix.jpeg")
        print("Using default voucher image path:", voucher_path)

    safe_print("🚀\tStarting Voucher Text Extraction")
    safe_print(f"📁\tImage: {voucher_path}")

    # Check if image exists
    if not os.path.exists(voucher_path):
        safe_print(f"❌\tError: Image file not found at {voucher_path}")
        return

    # Initialize database
    safe_print("🗃️\tInitializing database...")
    try:
        db_helper = get_database_instance()
        safe_print("✅\tDatabase initialized successfully")
    except Exception as e:
        safe_print(f"❌\tError initializing database: {str(e)}")
        return

    # Split image into quarters
    safe_print("✂️\tSplitting image into quarters...")
    original_img, quarters, _ = split_image(voucher_path)

    if original_img is None:
        return

    safe_print(f"✅\tImage split into {len(quarters)} quarters")

    # Extract text from all sections
    all_results = []

    # Extract from original full image
    safe_print("🔍\tExtracting text from full image...")
    full_results = extract_text_from_image(voucher_path, "full")
    all_results.extend(full_results)

    # Extract from each quarter
    quarter_names = ["top-left", "top-right", "bottom-left", "bottom-right"]
    for i, quarter in enumerate(quarters):
        safe_print(f"🔍\tExtracting text from {quarter_names[i]} quarter...")
        quarter_results = extract_text_from_image(quarter, quarter_names[i])
        all_results.extend(quarter_results)

    # Group and merge text by section
    safe_print(f"📝\tAll extracted text ({len(all_results)} total items):")

    sections = {}
    for item in all_results:
        section = item['section']
        if section not in sections:
            sections[section] = []
        sections[section].append(item['text'])

    # Print merged text for each section and save vouchers
    for section, texts in sections.items():
        merged_text = ' '.join(texts)
        # Use extract_voucher_codes instead of local regex
        matches = extract_voucher_codes(merged_text)

        print(f"[{section}] {merged_text}")
        if matches:
            safe_print(f"🎯\tFound voucher codes in {section}: {matches}")

            # Save each found voucher to database
            for voucher_code in matches:
                # Clean up the voucher code (remove extra spaces)
                clean_code = re.sub(r'\s+', '', voucher_code)
                store_voucher_in_database(db_helper, clean_code, voucher_path)

    safe_print("🎉\tExtraction completed successfully!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extract text from voucher images using OCR')
    parser.add_argument('-f', '--file',
                      default='test/fixtures/voucher-fix.jpeg',
                      help='Path to the voucher image file (default: test/fixtures/voucher-fix.jpeg)')

    args = parser.parse_args()
    main(args.file)
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extract text from voucher images using OCR')
    parser.add_argument('-f', '--file',
                      default='test/fixtures/voucher-fix.jpeg',
                      help='Path to the voucher image file (default: test/fixtures/voucher-fix.jpeg)')

    args = parser.parse_args()
    main(args.file)
