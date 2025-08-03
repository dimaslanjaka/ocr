import hashlib
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.database.VoucherDatabase import safe_print


def unique_hash(text: str) -> str:
    """Return the first 5 characters of the MD5 hash of a string."""
    return hashlib.md5(text.encode()).hexdigest()[:5]

def split_image(image_path):
    """Split image into 4 quarters, save them to tmp, and return list of image objects and file paths"""
    try:
        # Open the original image
        img = Image.open(image_path)
        width, height = img.size

        # Calculate split points
        mid_width = width // 2
        mid_height = height // 2

        # Create 4 quarters
        quarters = []
        quarter_paths = []

        # Ensure tmp directory exists
        tmp_dir = os.path.join(os.path.dirname(image_path), "tmp/split", unique_hash(image_path))
        os.makedirs(tmp_dir, exist_ok=True)

        # Top-left quarter
        q1 = img.crop((0, 0, mid_width, mid_height))
        quarters.append(q1)
        q1_path = os.path.join(tmp_dir, "quarter_1.png")
        q1.save(q1_path)
        quarter_paths.append(q1_path)

        # Top-right quarter
        q2 = img.crop((mid_width, 0, width, mid_height))
        quarters.append(q2)
        q2_path = os.path.join(tmp_dir, "quarter_2.png")
        q2.save(q2_path)
        quarter_paths.append(q2_path)

        # Bottom-left quarter
        q3 = img.crop((0, mid_height, mid_width, height))
        quarters.append(q3)
        q3_path = os.path.join(tmp_dir, "quarter_3.png")
        q3.save(q3_path)
        quarter_paths.append(q3_path)

        # Bottom-right quarter
        q4 = img.crop((mid_width, mid_height, width, height))
        quarters.append(q4)
        q4_path = os.path.join(tmp_dir, "quarter_4.png")
        q4.save(q4_path)
        quarter_paths.append(q4_path)

        return img, quarters, quarter_paths

    except Exception as e:
        safe_print(f"❌\tError splitting image: {str(e)}")
        return None, [], []
