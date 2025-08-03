import argparse
import os
import re
import sys
import warnings
import easyocr
from PIL import Image
from database.SQLiteHelper import SQLiteHelper
from database.VoucherDatabase import store_voucher_in_database

# Suppress PyTorch DataLoader warnings about pin_memory
warnings.filterwarnings("ignore", message=".*pin_memory.*")

def safe_print(message, file=sys.stderr):
    """Safely print messages, handling encoding issues"""
    try:
        print(message, file=file)
        file.flush()
    except UnicodeEncodeError:
        # Fallback to ASCII if Unicode fails
        print(message.encode('ascii', 'ignore').decode('ascii'), file=file)
        file.flush()

def split_image(image_path):
    """Split image into 4 quarters and return list of image objects"""
    try:
        # Open the original image
        img = Image.open(image_path)
        width, height = img.size

        # Calculate split points
        mid_width = width // 2
        mid_height = height // 2

        # Create 4 quarters
        quarters = []

        # Top-left quarter
        quarters.append(img.crop((0, 0, mid_width, mid_height)))

        # Top-right quarter
        quarters.append(img.crop((mid_width, 0, width, mid_height)))

        # Bottom-left quarter
        quarters.append(img.crop((0, mid_height, mid_width, height)))

        # Bottom-right quarter
        quarters.append(img.crop((mid_width, mid_height, width, height)))

        return img, quarters

    except Exception as e:
        safe_print(f"❌\tError splitting image: {str(e)}")
        return None, []

def extract_text_from_image(reader, image, section_name):
    """Extract text from a single image (PIL Image object or file path)"""
    try:
        if isinstance(image, str):
            # File path
            result = reader.readtext(image)
        else:
            # PIL Image object - convert to array
            import numpy as np
            img_array = np.array(image)
            result = reader.readtext(img_array)

        safe_print(f"✅\tFound {len(result)} text elements in {section_name}")

        # Format result data
        result_data = [{
            'bbox': [[int(coord) for coord in point] for point in bbox],
            'text': text,
            'confidence': float(conf),
            'section': section_name
        } for (bbox, text, conf) in result]

        return result_data

    except Exception as e:
        safe_print(f"❌\tError reading text from {section_name}: {str(e)}")
        return []

def main(voucher_path):
    """Main function to extract text from voucher image"""

    if not voucher_path:
        voucher_path = "test/fixtures/voucher - normalized rotation.jpeg"
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
        db_helper = SQLiteHelper("tmp/voucher_database.sqlite")
        safe_print("✅\tDatabase initialized successfully")
    except Exception as e:
        safe_print(f"❌\tError initializing database: {str(e)}")
        return

    # Initialize EasyOCR
    safe_print("🔧\tInitializing EasyOCR...")
    try:
        reader = easyocr.Reader(['en'], verbose=False)
        safe_print("✅\tEasyOCR initialized successfully")
    except Exception as e:
        safe_print(f"❌\tError initializing EasyOCR: {str(e)}")
        return

    # Split image into quarters
    safe_print("✂️\tSplitting image into quarters...")
    original_img, quarters = split_image(voucher_path)

    if original_img is None:
        return

    safe_print(f"✅\tImage split into {len(quarters)} quarters")

    # Extract text from all sections
    all_results = []

    # Extract from original full image
    safe_print("🔍\tExtracting text from full image...")
    full_results = extract_text_from_image(reader, voucher_path, "full")
    all_results.extend(full_results)

    # Extract from each quarter
    quarter_names = ["top-left", "top-right", "bottom-left", "bottom-right"]
    for i, quarter in enumerate(quarters):
        safe_print(f"🔍\tExtracting text from {quarter_names[i]} quarter...")
        quarter_results = extract_text_from_image(reader, quarter, quarter_names[i])
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
        regex = r'\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b'

        # Find matches in the merged text
        matches = re.findall(regex, merged_text)

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
                      default='test/fixtures/voucher - normalized rotation.jpeg',
                      help='Path to the voucher image file (default: test/fixtures/voucher - normalized rotation.jpeg)')

    args = parser.parse_args()
    main(args.file)