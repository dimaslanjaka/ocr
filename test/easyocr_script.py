import sys
import json
import easyocr
import os
import re

# Set UTF-8 encoding for Windows
if os.name == 'nt':  # Windows
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

def safe_print(message, file=sys.stderr):
    """Safely print messages, handling encoding issues"""
    try:
        print(message, file=file)
        file.flush()
    except UnicodeEncodeError:
        # Fallback to ASCII if Unicode fails
        print(message.encode('ascii', 'ignore').decode('ascii'), file=file)
        file.flush()

def main(voucher_path = "test/fixtures/voucher - normalized rotation.jpeg"):
    """Main function to extract text from voucher image"""

    safe_print("🚀 Starting Voucher Text Extraction")
    safe_print(f"📁 Image: {voucher_path}")

    # Check if image exists
    if not os.path.exists(voucher_path):
        safe_print(f"❌ Error: Image file not found at {voucher_path}")
        return

    # Initialize EasyOCR
    safe_print("🔧 Initializing EasyOCR...")
    try:
        reader = easyocr.Reader(['en'], verbose=False)
        safe_print("✅ EasyOCR initialized successfully")
    except Exception as e:
        safe_print(f"❌ Error initializing EasyOCR: {str(e)}")
        return

    # Extract text
    safe_print("🔍 Extracting text from image...")
    try:
        result = reader.readtext(voucher_path)
        safe_print(f"✅ Found {len(result)} text elements")
    except Exception as e:
        safe_print(f"❌ Error reading text: {str(e)}")
        return

    # Format result data
    result_data = [{
        'bbox': [[int(coord) for coord in point] for point in bbox],
        'text': text,
        'confidence': float(conf)
    } for (bbox, text, conf) in result]

    for item in result_data:
        print(item['text'])

    safe_print("🎉 Extraction completed successfully!")

if __name__ == '__main__':
    main()