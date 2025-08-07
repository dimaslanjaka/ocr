from io import BytesIO
import os
import sys
import cv2
import numpy as np
from PIL import Image
import imageio.v3 as iio
import requests
import pytesseract
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.ocr.image_utils import dewarp_image
from src.utils.file import get_relative_path


def get_image_from_url_or_path(image_source: str, cache_dir: str= "tmp/downloaded_images") -> np.ndarray:
    """
    Load an image from a URL or a local file path, with caching for URLs.

    Args:
        image_source (str): URL or local file path of the image.

    Returns:
        numpy.ndarray: Loaded image.
    """
    import hashlib

    if image_source.startswith("http://") or image_source.startswith("https://"):
        # Use a cache directory for downloaded images
        cache_dir = get_relative_path(cache_dir)
        os.makedirs(cache_dir, exist_ok=True)
        # Hash the URL to create a unique filename
        url_hash = hashlib.sha256(image_source.encode("utf-8")).hexdigest()
        ext = os.path.splitext(image_source)[1]
        if not ext or len(ext) > 5:
            ext = ".jpg"
        cache_path = os.path.join(cache_dir, url_hash + ext)
        if os.path.exists(cache_path):
            image = cv2.imread(cache_path, cv2.IMREAD_COLOR)
        else:
            response = requests.get(image_source)
            image = cv2.imdecode(
                np.frombuffer(BytesIO(response.content).read(), np.uint8), cv2.IMREAD_COLOR
            )
            if image is not None:
                cv2.imwrite(cache_path, image)
    else:
        # Resolve relative path to absolute path
        if not os.path.isabs(image_source):
            image_source = os.path.abspath(image_source)
        image = cv2.imread(image_source, cv2.IMREAD_COLOR)
        if image is None:
            try:
                img = iio.imread(image_source)
                # Convert grayscale to BGR
                if len(img.shape) == 2:
                    image = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                elif img.shape[2] == 4:
                    image = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
                else:
                    image = img
            except Exception as e:
                raise ValueError(
                    f"Image could not be loaded. Check the URL or file path. Details: {e}"
                )

    if image is None:
        raise ValueError("Image could not be loaded. Check the URL or file path.")

    return image


def main(imagePathOrUrl="test/fixtures/noise.avif", crop: bool = False, output_dir: str = "tmp/pre-process"):
    image = get_image_from_url_or_path(imagePathOrUrl)
    basename = os.path.splitext(os.path.basename(imagePathOrUrl))[0] + ".png"

    # Convert to PNG before pre-processing
    converted_output = os.path.normpath(os.path.join(output_dir, "converted", basename))
    os.makedirs(os.path.dirname(converted_output), exist_ok=True)
    cv2.imwrite(converted_output, image)
    print(f"Image converted to PNG and saved to {converted_output}")
    # Optionally reload the PNG to ensure all further processing uses the PNG version
    image = cv2.imread(converted_output, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Failed to reload PNG image from {converted_output}")

    # Apply Gaussian blur
    image = cv2.GaussianBlur(image, (5, 5), 1.0)
    blurred_output = os.path.join(output_dir, "blurred", basename)
    os.makedirs(os.path.dirname(blurred_output), exist_ok=True)
    cv2.imwrite(blurred_output, image)
    print(f"Blurred image saved to {blurred_output}")

    # Dewarp the image
    result_dewarp = dewarp_image(image)
    if result_dewarp is not None:
        dewarped_image, dewarped_path = result_dewarp
        print(f"Dewarped image saved to {dewarped_path}")
        # Convert to numpy array if needed
        if isinstance(dewarped_image, Image.Image):
            image = np.array(dewarped_image)
        else:
            image = dewarped_image
    else:
        print("Dewarping failed: dewarp_image returned None")

    # Run OCR
    ocr_text = pytesseract.image_to_string(image, lang="eng", config="--psm 6")

    # Crop for numpy ndarray (OpenCV image)
    if crop:
        height, width = image.shape[:2]
        crops = [
            ("full", image),
            ("top_half", image[:height // 2, :]),
            ("bottom_half", image[height // 2:, :]),
            ("left_half", image[:, :width // 2]),
            ("right_half", image[:, width // 2:]),
        ]
        crops_dir = os.path.join(output_dir, "crops")
        os.makedirs(crops_dir, exist_ok=True)
        for name, crop_img in crops:
            crop_output_path = os.path.join(crops_dir, f"{name}.png")
            cv2.imwrite(crop_output_path, crop_img)
            print(f"Cropped image '{name}' saved to {crop_output_path}")

    print(f"OCR output:\n\n{ocr_text}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pre-process an image for OCR")
    parser.add_argument(
        "-i",
        "--image",
        default="test/fixtures/noise.avif",
        help="Path or URL to the image file",
    )
    parser.add_argument(
        "-c",
        "--crop",
        action="store_true",
        help="Enable cropping of the image into halves and quarters",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default="tmp/pre-process",
        help="Directory to save processed images and crops",
    )
    args = parser.parse_args()
    main(
        imagePathOrUrl=args.image,
        crop=args.crop,
        output_dir=args.output_dir
    )
