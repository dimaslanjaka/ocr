import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import time
import pytest
import numpy as np
import cv2
from src.ocr import pre_process

def test_get_image_from_url_or_path_local():
    # Create a dummy image
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    output_dir = os.path.abspath("tmp/pre-process/test_get_image_from_url_or_path_local")
    os.makedirs(output_dir, exist_ok=True)
    img_path = os.path.join(output_dir, "dummy.png")
    cv2.imwrite(img_path, img)
    # Should load without error
    loaded = pre_process.get_image_from_url_or_path(img_path)
    assert loaded.shape == (10, 10, 3)

def test_get_image_from_url_or_path_invalid():
    output_dir = os.path.abspath("tmp/pre-process/test_get_image_from_url_or_path_invalid")
    os.makedirs(output_dir, exist_ok=True)
    with pytest.raises(ValueError):
        pre_process.get_image_from_url_or_path(os.path.join(output_dir, "not_a_real_file.png"))

def test_main_runs_and_outputs(capsys):
    # Create a dummy image
    img = np.ones((20, 20, 3), dtype=np.uint8) * 255
    output_dir = os.path.abspath("tmp/pre-process/test_main_runs_and_outputs")
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    img_path = os.path.join(output_dir, "white.png")
    cv2.imwrite(img_path, img)
    # Run main
    pre_process.main(imagePathOrUrl=img_path, crop=True, output_dir=output_dir)
    assert os.path.exists(os.path.join(output_dir, "converted", "white.png"))
    assert os.path.exists(os.path.join(output_dir, "blurred", "white.png"))
    # The crop images may be saved in a different directory if dewarping changes the basename
    # Find all PNG files in the output_dir recursively
    # Check for crop images in the expected crops directory only
    crops_dir = os.path.join(output_dir, "crops")
    expected_crops = ["full.png", "top_half.png", "bottom_half.png", "left_half.png", "right_half.png"]
    missing = []
    for crop_name in expected_crops:
        crop_path = os.path.join(crops_dir, crop_name)
        for _ in range(30):  # Retry for up to 3 seconds
            if os.path.exists(crop_path):
                break
            time.sleep(0.1)
        if not os.path.exists(crop_path):
            missing.append(str(crop_path))
    assert not missing, f"Missing crop files: {missing}"
    # Check OCR output in stdout
    out = capsys.readouterr().out
    assert "OCR output" in out

if __name__ == "__main__":
    pytest.main([__file__])
