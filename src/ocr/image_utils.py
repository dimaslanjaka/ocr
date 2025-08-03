import hashlib
import os
import sys
from PIL import Image
import cv2
import numpy as np
from typing import Union
import io

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.database.VoucherDatabase import safe_print
from src.utils.file import get_relative_path


def unique_hash(text_or_image: Union[str, Image.Image]) -> str:
    """Return the first 5 characters of the MD5 hash of a string or PIL Image."""
    if isinstance(text_or_image, str):
        data = text_or_image.encode()
    elif isinstance(text_or_image, Image.Image):
        # Use image bytes for hashing
        buf = io.BytesIO()
        text_or_image.save(buf, format="PNG")
        data = buf.getvalue()
    else:
        raise TypeError("unique_hash accepts only str or PIL.Image.Image")
    return hashlib.md5(data).hexdigest()[:5]


def split_image(
    image: Union[str, Image.Image],
    mode: str = "quarters",  # "quarters" (default) or "halves"
) -> tuple[Image.Image | None, list[Image.Image], list[str]]:
    """
    Split image (from path or PIL.Image) into 4 quarters or 2 left/right halves.
    Saves them to tmp, and returns list of image objects and file paths.
    mode: "quarters" (default) or "halves"
    """
    try:
        # Accept either a file path or a PIL Image object
        if isinstance(image, str):
            img = Image.open(image)
            image_path = image
        elif isinstance(image, Image.Image):
            img = image
            image_path = getattr(img, "filename", "in_memory_image")
        else:
            safe_print("❌\tInvalid input type for split_image.")
            return None, [], []

        width, height = img.size

        splits = []
        split_paths = []

        hash_dir = get_relative_path("tmp/split", unique_hash(image_path))
        os.makedirs(hash_dir, exist_ok=True)

        if mode == "halves":
            # Left half
            left = img.crop((0, 0, width // 2, height))
            left_path = os.path.join(hash_dir, "half_left.png")
            left.save(left_path)
            splits.append(left)
            split_paths.append(left_path)
            # Right half
            right = img.crop((width // 2, 0, width, height))
            right_path = os.path.join(hash_dir, "half_right.png")
            right.save(right_path)
            splits.append(right)
            split_paths.append(right_path)
        elif mode == "quarters":
            mid_width = width // 2
            mid_height = height // 2
            # Top-left quarter
            q1 = img.crop((0, 0, mid_width, mid_height))
            q1_path = os.path.join(hash_dir, "quarter_1.png")
            q1.save(q1_path)
            splits.append(q1)
            split_paths.append(q1_path)
            # Top-right quarter
            q2 = img.crop((mid_width, 0, width, mid_height))
            q2_path = os.path.join(hash_dir, "quarter_2.png")
            q2.save(q2_path)
            splits.append(q2)
            split_paths.append(q2_path)
            # Bottom-left quarter
            q3 = img.crop((0, mid_height, mid_width, height))
            q3_path = os.path.join(hash_dir, "quarter_3.png")
            q3.save(q3_path)
            splits.append(q3)
            split_paths.append(q3_path)
            # Bottom-right quarter
            q4 = img.crop((mid_width, mid_height, width, height))
            q4_path = os.path.join(hash_dir, "quarter_4.png")
            q4.save(q4_path)
            splits.append(q4)
            split_paths.append(q4_path)
        else:
            safe_print(f"❌\tUnknown split mode: {mode}")
            return None, [], []

        return img, splits, split_paths

    except Exception as e:
        safe_print(f"❌\tError splitting image: {str(e)}")
        return None, [], []


def dewarp_image(image: Union[str, Image.Image]) -> tuple[Image.Image, str] | None:
    """
    Attempt to dewarp an image using perspective transform.
    Accepts a file path or PIL Image. Returns the dewarped image as a PIL Image object and output path.
    """
    try:
        # Accept either a file path or a PIL Image object
        if isinstance(image, str):
            img = cv2.imread(image)
            image_path = image
        elif isinstance(image, Image.Image):
            img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            image_path = getattr(image, "filename", "in_memory_image")
        else:
            safe_print("❌\tInvalid input type for dewarp_image.")
            return None

        if img is None:
            safe_print(f"❌\tError loading image for dewarping: {image_path}")
            return None

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Use adaptive thresholding for better results
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 15
        )

        # Optionally save thresholded image for debugging
        debug_dir = os.path.join("tmp", "dewarp_debug")
        os.makedirs(debug_dir, exist_ok=True)
        debug_thresh_path = os.path.join(
            debug_dir, f"{unique_hash(image_path)}_thresh.png"
        )
        cv2.imwrite(debug_thresh_path, thresh)

        # Find contours
        contours, _ = cv2.findContours(
            thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            safe_print("❌\tNo contours found for dewarping.")
            return None

        # Find the largest contour (assume it's the document)
        contour = max(contours, key=cv2.contourArea)
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        if len(approx) == 4:
            pts = approx.reshape(4, 2)
            # Order points: top-left, top-right, bottom-right, bottom-left
            rect = np.zeros((4, 2), dtype="float32")
            s = pts.sum(axis=1)
            rect[0] = pts[np.argmin(s)]
            rect[2] = pts[np.argmax(s)]
            diff = np.diff(pts, axis=1)
            rect[1] = pts[np.argmin(diff)]
            rect[3] = pts[np.argmax(diff)]

            (tl, tr, br, bl) = rect
            widthA = np.linalg.norm(br - bl)
            widthB = np.linalg.norm(tr - tl)
            maxWidth = max(int(widthA), int(widthB))

            heightA = np.linalg.norm(tr - br)
            heightB = np.linalg.norm(tl - bl)
            maxHeight = max(int(heightA), int(heightB))

            dst = np.array(
                [
                    [0, 0],
                    [maxWidth - 1, 0],
                    [maxWidth - 1, maxHeight - 1],
                    [0, maxHeight - 1],
                ],
                dtype="float32",
            )

            M = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(img, M, (maxWidth, maxHeight))

            # Convert back to PIL Image
            dewarped_img = Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))

            # Optionally save
            output_path = f"tmp/dewarped/{unique_hash(image_path)}.png"
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            dewarped_img.save(output_path)

            return dewarped_img, output_path
        else:
            # Optionally save the contour image for debugging
            debug_contour_path = os.path.join(
                debug_dir, f"{unique_hash(image_path)}_contours.png"
            )
            contour_img = img.copy()
            cv2.drawContours(contour_img, [contour], -1, (0, 255, 0), 2)
            cv2.imwrite(debug_contour_path, contour_img)
            safe_print(
                "❌\tCould not find 4 corners for perspective transform. Debug images saved."
            )
            return None

    except Exception as e:
        safe_print(f"❌\tError dewarping image: {str(e)}")
        return None


def rotate_image(image: Union[str, Image.Image]) -> list[tuple[Image.Image, int, str]]:
    """
    Rotate the image in 0, 90, 180, 270 degrees and return a list of (rotated_image, angle, save_path).
    Saves each rotated image to tmp/rotate/{unique_hash(image_path)}/angle_{angle}.png.
    """
    try:
        if isinstance(image, str):
            img = Image.open(image)
            image_path = image
        elif isinstance(image, Image.Image):
            img = image
            image_path = getattr(img, "filename", "in_memory_image")
        else:
            safe_print("❌\tInvalid input type for rotate_image.")
            return []

        hash_dir = os.path.join("tmp", "rotate", unique_hash(image_path))
        os.makedirs(hash_dir, exist_ok=True)
        rotated_images = []
        for angle in [0, 90, 180, 270]:
            rotated = img.rotate(angle, expand=True)
            save_path = os.path.join(hash_dir, f"angle_{angle}.png")
            rotated.save(save_path)
            rotated_images.append((rotated, angle, save_path))
        return rotated_images
    except Exception as e:
        safe_print(f"❌\tError rotating image: {str(e)}")
        return []
