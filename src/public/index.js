import { hideLoading, showError, showLoading, showResult, showSuccess } from './shared.js';
import { getBaseUrl } from '../utils/url.js';

let cameraStream = null;
let cameraVideo = null;
let cameraCanvas = null;
let currentOrientation = 'portrait';
let availableCameras = [];

// Initialize camera elements
document.addEventListener('DOMContentLoaded', function () {
  cameraVideo = document.getElementById('cameraVideo');
  cameraCanvas = document.getElementById('cameraCanvas');

  // Camera control buttons
  document.getElementById('startCamera').addEventListener('click', startCamera);
  document.getElementById('captureImage').addEventListener('click', captureImage);
  document.getElementById('stopCamera').addEventListener('click', stopCamera);
  document.getElementById('refreshCameras').addEventListener('click', getCameraDevices);
  document.getElementById('orientationPortrait').addEventListener('click', () => setOrientation('portrait'));
  document.getElementById('orientationLandscape').addEventListener('click', () => setOrientation('landscape'));

  // Initialize camera devices
  getCameraDevices();
});

async function getCameraDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter((device) => device.kind === 'videoinput');

    const cameraSelect = document.getElementById('cameraSelect');
    cameraSelect.innerHTML = '<option value="">Select Camera</option>';

    availableCameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    if (availableCameras.length === 0) {
      showError('No cameras found on this device.');
    }
  } catch (error) {
    showError(`Error accessing camera devices: ${error.message}`);
  }
}

function setOrientation(orientation) {
  currentOrientation = orientation;

  // Update button styles
  const portraitBtn = document.getElementById('orientationPortrait');
  const landscapeBtn = document.getElementById('orientationLandscape');

  if (orientation === 'portrait') {
    portraitBtn.className =
      'flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors';
    landscapeBtn.className =
      'flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors';
  } else {
    landscapeBtn.className =
      'flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors';
    portraitBtn.className =
      'flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors';
  }

  // Update video container height based on orientation
  updateVideoContainerSize();
}

function updateVideoContainerSize() {
  const videoElement = document.getElementById('cameraVideo');
  const placeholder = document.getElementById('cameraPlaceholder');

  if (currentOrientation === 'landscape') {
    videoElement.className = 'w-full h-64 bg-gray-200 rounded-lg hidden object-cover';
    placeholder.className = 'w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center';
  } else {
    videoElement.className = 'w-full h-48 bg-gray-200 rounded-lg hidden object-cover';
    placeholder.className = 'w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center';
  }
}

async function startCamera() {
  try {
    const cameraSelect = document.getElementById('cameraSelect');
    const selectedCameraId = cameraSelect.value;

    let constraints = {
      video: {
        facingMode: selectedCameraId ? undefined : 'environment'
      }
    };

    // Set orientation-specific constraints
    if (currentOrientation === 'landscape') {
      constraints.video.width = { ideal: 1280 };
      constraints.video.height = { ideal: 720 };
    } else {
      constraints.video.width = { ideal: 720 };
      constraints.video.height = { ideal: 1280 };
    }

    // Use specific camera if selected
    if (selectedCameraId) {
      constraints.video.deviceId = { exact: selectedCameraId };
    }

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);

    cameraVideo.srcObject = cameraStream;
    cameraVideo.classList.remove('hidden');
    document.getElementById('cameraPlaceholder').classList.add('hidden');

    // Enable/disable buttons
    document.getElementById('startCamera').disabled = true;
    document.getElementById('captureImage').disabled = false;
    document.getElementById('stopCamera').disabled = false;

    showSuccess(`Camera started in ${currentOrientation} mode!`);
  } catch (error) {
    showError(`Camera error: ${error.message}. Please check camera permissions and try selecting a different camera.`);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraVideo.classList.add('hidden');
  document.getElementById('cameraPlaceholder').classList.remove('hidden');

  // Enable/disable buttons
  document.getElementById('startCamera').disabled = false;
  document.getElementById('captureImage').disabled = true;
  document.getElementById('stopCamera').disabled = true;

  showSuccess('Camera stopped.');
}

async function captureImage() {
  if (!cameraVideo || !cameraStream) {
    showError('Camera is not active.');
    return;
  }

  // Set canvas size to match video
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;

  // Draw current video frame to canvas
  const ctx = cameraCanvas.getContext('2d');
  ctx.drawImage(cameraVideo, 0, 0);

  // Convert canvas to blob
  cameraCanvas.toBlob(
    async (blob) => {
      if (!blob) {
        showError('Failed to capture image.');
        return;
      }

      showLoading();

      try {
        const formData = new FormData();
        formData.append('image', blob, 'camera-capture.jpg');

        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/upload`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          showResult(result.text);
          showSuccess('Successfully processed camera capture!');
        } else {
          const errorText = await response.text();
          showError(`Error: ${errorText}`);
        }
      } catch (error) {
        showError(`Network error: ${error.message}`);
      }

      hideLoading();
    },
    'image/jpeg',
    0.8
  );
}

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
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      if (result.jobId) {
        // Poll for result
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

// Polling function for OCR result
async function pollOcrResult(jobId, filename) {
  let tries = 0;
  // Remove maxTries, poll forever until job is done or failed
  while (true) {
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/result/${jobId}`);
      const data = await res.json();
      if (data.status === 'completed') {
        if (data.text) {
          showResult(data.text);
        } else if (data.result && data.result.text) {
          showResult(data.result.text);
        }
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

// URL form handler
document.getElementById('urlForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const imageUrl = document.getElementById('imageUrl').value;

  if (!imageUrl) {
    showError('Please enter an image URL.');
    return;
  }

  showLoading();

  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/url?imageurl=${encodeURIComponent(imageUrl)}`);

    if (response.ok) {
      const text = await response.text();
      showResult(text);
      showSuccess('Successfully processed image from URL!');
    } else {
      const errorText = await response.text();
      showError(`Error: ${errorText}`);
    }
  } catch (error) {
    showError(`Network error: ${error.message}`);
  }

  hideLoading();
});

// File selection display
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

// Drag and drop support for upload area
document.addEventListener('DOMContentLoaded', function () {
  // Drag and drop handlers
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
      // Trigger change event to update file name display
      fileInput.dispatchEvent(new Event('change'));
    }
  });
});
