const fs = require('fs');
const path = require('path');

// Script to prepare custom Tesseract training data
// Requires: tesstrain toolkit, training images, ground truth files

console.log('Custom Tesseract Training Preparation');
console.log('=====================================');
console.log('');
console.log('Steps to create custom traineddata:');
console.log('1. Install tesstrain: https://github.com/tesseract-ocr/tesstrain');
console.log('2. Prepare training images (TIFF format recommended)');
console.log('3. Create ground truth .gt.txt files');
console.log('4. Run training with tesstrain');
console.log('5. Copy generated .traineddata to data/ folder');
console.log('');
console.log('For fine-tuning existing models, use:');
console.log('make training MODEL_NAME=custom START_MODEL=eng TESSDATA=../tessdata_best');
