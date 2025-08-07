import { getBaseUrl } from '../utils/url.js';
import { hideLoading, showError, showLoading, showResult, showSuccess } from './shared.js';

const baseUrl = getBaseUrl();
let cameraStream = null;
let cameraVideo = null;
let cameraCanvas = null;
let currentOrientation = 'portrait';
let availableCameras = [];
document.addEventListener('DOMContentLoaded', function () {
  cameraVideo = document.getElementById('cameraVideo');
  cameraCanvas = document.getElementById('cameraCanvas');
  document.getElementById('startCamera').addEventListener('click', startCamera);
  document.getElementById('captureImage').addEventListener('click', captureImage);
  document.getElementById('stopCamera').addEventListener('click', stopCamera);
  document.getElementById('refreshCameras').addEventListener('click', getCameraDevices);
  document.getElementById('orientationPortrait').addEventListener('click', () => setOrientation('portrait'));
  document.getElementById('orientationLandscape').addEventListener('click', () => setOrientation('landscape'));
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
    if (currentOrientation === 'landscape') {
      constraints.video.width = { ideal: 1280 };
      constraints.video.height = { ideal: 720 };
    } else {
      constraints.video.width = { ideal: 720 };
      constraints.video.height = { ideal: 1280 };
    }
    if (selectedCameraId) {
      constraints.video.deviceId = { exact: selectedCameraId };
    }
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraVideo.srcObject = cameraStream;
    cameraVideo.classList.remove('hidden');
    document.getElementById('cameraPlaceholder').classList.add('hidden');
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
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  const ctx = cameraCanvas.getContext('2d');
  ctx.drawImage(cameraVideo, 0, 0);
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
        const response = await fetch(`${baseUrl}/upload`, {
          method: 'POST',
          body: formData
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
    },
    'image/jpeg',
    0.8
  );
}

async function pollForResult(jobId) {
  try {
    const response = await fetch(`${baseUrl}/upload/result/${jobId}`);
    if (response.ok) {
      const result = await response.json();
      if (result.status === 'completed') {
        if (result.text) {
          showResult(result.text);
        } else if (result.result && result.result.text) {
          showResult(result.result.text);
        }
        showSuccess('Successfully processed camera capture!');
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
