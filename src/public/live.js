import { getBaseUrl } from '../utils/url.js';
const videoElement = document.getElementById('liveVideo');
const cameraSelect = document.getElementById('cameraSelect');
const startStreamBtn = document.getElementById('startStreamBtn');
const stopStreamBtn = document.getElementById('stopStreamBtn');
let currentStream;
let frameInterval;

// List cameras and populate select
async function getCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((device) => device.kind === 'videoinput');
  cameraSelect.innerHTML = '';
  videoDevices.forEach((device, idx) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Camera ${idx + 1}`;
    cameraSelect.appendChild(option);
  });
}

// Start stream from selected camera
async function startStream(deviceId) {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }
  if (frameInterval) clearInterval(frameInterval);

  try {
    const constraints = { video: { deviceId: deviceId ? { exact: deviceId } : undefined }, audio: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    currentStream = stream;

    // Start sending frames to backend
    startFrameCapture();
  } catch (err) {
    alert('Could not access camera: ' + err);
  }
}

// Stop stream
function stopStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
  videoElement.srcObject = null;
}

// Capture frames & send to backend
function startFrameCapture() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  frameInterval = setInterval(() => {
    if (!videoElement.videoWidth) return; // wait for video

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0);

    canvas.toBlob(
      (blob) => {
        const formData = new FormData();
        formData.append('frame', blob, 'frame.jpg');

        const baseUrl = getBaseUrl();
        fetch(`${baseUrl}/upload`, {
          method: 'POST',
          body: formData
        }).catch((err) => console.error('Upload failed:', err));
      },
      'image/jpeg',
      0.7
    );
  }, 200); // every 200ms
}

// On camera selection change
cameraSelect.addEventListener('change', () => {
  startStream(cameraSelect.value);
});

// Start/Stop button events
startStreamBtn.addEventListener('click', () => {
  startStream(cameraSelect.value);
});
stopStreamBtn.addEventListener('click', () => {
  stopStream();
});

// Initialize
async function init() {
  await getCameras();
  // Automatically start stream if cameras are available
  // if (cameraSelect.options.length > 0) {
  //   await startStream(cameraSelect.value);
  // }
  // Update camera list if devices change
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await getCameras();
  });
}
init();
