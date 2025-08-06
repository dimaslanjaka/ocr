import { showLoading, hideLoading, showResult, showError, showSuccess, clearMessages } from './shared.js';

// File upload form handler
document.getElementById('uploadForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const formData = new FormData();
  const fileInput = document.getElementById('imageFile');
  const file = fileInput.files[0];
  if (!file) {
    showError('Please select an image file.');
    return;
  }
  formData.append('image', file);
  showLoading();
  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    if (response.ok) {
      const result = await response.json();
      if (result.jobId) {
        await pollOcrResult(result.jobId, result.filename);
      } else {
        showError('No job ID returned from server.');
      }
    } else {
      const errorText = await response.text();
      showError(`Error: ${errorText}`);
    }
  } catch (error) {
    showError(`Network error: ${error.message}`);
  }
  hideLoading();
});
async function pollOcrResult(jobId, filename) {
  let tries = 0;
  // Remove maxTries, poll forever until job is done or failed
  while (true) {
    try {
      const res = await fetch(`/result/${jobId}`);
      const data = await res.json();
      if (data.status === 'completed') {
        showResult(data);
        showSuccess(`Successfully processed: ${filename}`);
        return;
      } else if (data.status === 'failed') {
        showError('OCR failed: ' + data.error);
        return;
      } else if (data.status === 'pending') {
        document.getElementById('result').textContent = `Job pending... (state: pending, try ${tries + 1})`;
      } else if (data.status === 'not_found') {
        showError('Job not found.');
        return;
      } else if (data.status === 'error') {
        showError('Server error: ' + data.error);
        return;
      } else {
        showError('Unknown job state: ' + JSON.stringify(data));
        return;
      }
    } catch (err) {
      showError('Error fetching OCR result: ' + err.message);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
    tries++;
  }
}
document.getElementById('imageFile').addEventListener('change', function (e) {
  const fileName = e.target.files[0]?.name;
  const fileNameDiv = document.getElementById('fileName');
  if (fileName) {
    fileNameDiv.textContent = `Selected: ${fileName}`;
    fileNameDiv.className = 'text-sm text-green-600 text-center';
  } else {
    fileNameDiv.textContent = '';
  }
});
document.addEventListener('DOMContentLoaded', function () {
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('imageFile');
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('border-blue-400', 'bg-blue-50');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('border-blue-400', 'bg-blue-50');
    });
  });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      fileInput.files = files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  // Handle paste (Ctrl+V) with image in clipboard
  document.addEventListener('paste', function (e) {
    if (!e.clipboardData || !e.clipboardData.items) return;
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        // Create a DataTransfer to set the file input
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
        break;
      }
    }
  });
});
