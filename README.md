# Node OCR App

A cross-platform OCR (Optical Character Recognition) project with Python and Node.js components.

## Quick Start

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
python setup.py build develop
```

### 2. Install Tesseract OCR
- **Windows:**
  ```bash
  choco install tesseract -y
  ```
- **Other platforms:** See [Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Compiling.html#windows)

---

## Project Structure
- `src/` — Main source code (Python & JS)
- `packages/page-dewarp/` — Page dewarping utilities
- `public/`, `views/` — Web assets
- `test/` — Test scripts and fixtures
- `tessdata/` — Tesseract language data files

## Useful Links
- [Tesseract Build Instructions](https://tesseract-ocr.github.io/tessdoc/Compiling.html#windows)

---

For more details, see individual module READMEs or comments in the code.
