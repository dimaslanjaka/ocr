import { showLoading, hideLoading, showResult, showError, showSuccess, clearMessages } from './shared.js';

document.getElementById('urlForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const imageUrl = document.getElementById('imageUrl').value;
  if (!imageUrl) {
    showError('Please enter an image URL.');
    return;
  }
  showLoading();
  try {
    // POST to /upload with imageUrl as JSON
    const response = await fetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    });
    if (response.ok) {
      const { jobId } = await response.json();
      if (!jobId) {
        showError('No jobId returned from server.');
        hideLoading();
        return;
      }
      pollForResult(jobId);
    } else {
      const errorText = await response.text();
      showError(`Error: ${errorText}`);
      hideLoading();
    }
  } catch (error) {
    showError(`Network error: ${error.message}`);
    hideLoading();
  }
});

async function pollForResult(jobId) {
  try {
    const response = await fetch(`/result/${jobId}`);
    if (response.ok) {
      const result = await response.json();
      if (result.status === 'completed') {
        if (result.text) {
          showResult(result.text);
        } else if (result.result && result.result.text) {
          showResult(result.result.text);
        }
        showSuccess('Successfully processed image from URL!');
        hideLoading();
      } else if (result.status === 'failed') {
        showError(result.error || 'OCR job failed.');
        hideLoading();
      } else if (result.status === 'pending' || result.status === 'waiting' || result.status === 'active') {
        setTimeout(() => pollForResult(jobId), 1200);
      } else {
        showError('Unknown job status.');
        hideLoading();
      }
    } else {
      showError('Failed to fetch job status.');
      hideLoading();
    }
  } catch (error) {
    showError(`Error polling for result: ${error.message}`);
    hideLoading();
  }
}
