from PIL import Image
from src.database.VoucherDatabase import safe_print

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
