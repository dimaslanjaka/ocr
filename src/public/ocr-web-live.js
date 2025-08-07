// JS for /public/ocr-web-live.html (Live camera OCR)
import $ from 'jquery';
import _ from 'lodash';

$(function () {
  const video = document.getElementById('video');
  const videoPlaceholder = document.getElementById('video-placeholder');
  const canvas = document.getElementById('canvas');
  const captureBtn = document.getElementById('capture');
  const startBtn = document.getElementById('start-camera');
  const stopBtn = document.getElementById('stop-camera');
  const previewImg = document.getElementById('form-image-preview');
  const cameraSelect = document.getElementById('camera-select');
  let capturedBlob = null;
  let stream = null;
  let currentDeviceId = null;

  // Populate camera select
  function updateCameraList() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function(devices) {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      cameraSelect.innerHTML = '';
      videoDevices.forEach((device, idx) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${idx + 1}`;
        cameraSelect.appendChild(option);
      });
      if (videoDevices.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.text = 'No camera found';
        cameraSelect.appendChild(option);
      }
    });
  }
  updateCameraList();
  // Refresh camera list when devices change
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', updateCameraList);
  }

  cameraSelect.addEventListener('change', function() {
    currentDeviceId = cameraSelect.value;
    // Optionally, auto-restart camera if already running
    if (stream) {
      stopBtn.click();
      startBtn.click();
    }
  });

  // Start camera on button click
  startBtn.addEventListener('click', function () {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const constraints = { video: {} };
      if (cameraSelect.value) {
        constraints.video.deviceId = { exact: cameraSelect.value };
      } else {
        constraints.video = true;
      }
      navigator.mediaDevices.getUserMedia(constraints)
        .then(function (s) {
          stream = s;
          video.srcObject = stream;
          // Show video, hide placeholder, hide preview
          if (videoPlaceholder) videoPlaceholder.style.display = 'none';
          video.style.visibility = 'visible';
          previewImg.classList.add('hidden');
          video.play();
          captureBtn.disabled = false;
          stopBtn.disabled = false;
          startBtn.disabled = true;
        })
        .catch(function (err) {
          alert('Could not access camera: ' + err);
        });
    } else {
      alert('Camera not supported in this browser.');
    }
  });

  // Stop camera on button click
  stopBtn.addEventListener('click', function () {
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      stream = null;
    }
    video.srcObject = null;
    if (videoPlaceholder) videoPlaceholder.style.display = '';
    video.style.visibility = 'hidden';
    captureBtn.disabled = true;
    stopBtn.disabled = true;
    startBtn.disabled = false;
  });
  // Initial state: hide video, show placeholder
  video.style.visibility = 'hidden';
  if (videoPlaceholder) videoPlaceholder.style.display = '';

  // Capture image from video
  captureBtn.addEventListener('click', function () {
    if (!stream) {
      alert('Camera is not started.');
      return;
    }
    // Set canvas size to match video stream resolution
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) {
      canvas.width = vw;
      canvas.height = vh;
    }
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(function (blob) {
      capturedBlob = blob;
      const url = URL.createObjectURL(blob);
      previewImg.src = url;
      previewImg.classList.remove('hidden');
    }, 'image/png');
  });

  // OCR on submit (moved to fixed bottom bar button)
  const ocrSubmitBtn = document.getElementById('ocr-submit');
  function doOcrSubmit(e) {
    if (e) e.preventDefault();
    if (!capturedBlob) {
      alert("Please capture an image first.");
      return;
    }
    let status = {};
    $("#progress").empty();
    $("#result").empty();
    Tesseract.recognize(capturedBlob, { lang: $("#lang").val() })
      .progress((result) => {
        let p = result.progress * 100;
        if (!status[result.status]) {
          status[result.status] = true;
          $("#progress").append(`
            <p class=\"mb-1 text-sm font-medium text-blue-700\">${result.status}</p>
            <div class=\"w-full bg-gray-200 rounded-full h-3.5 mb-4 dark:bg-gray-700\">
              <div class=\"progress-bar progress-bar${_.size(status)} bg-blue-600 h-3.5 rounded-full text-xs text-white flex items-center justify-center transition-all duration-300\" style=\"width:0%\"></div>
            </div>
          `);
        }
        if (_.isNaN(p)) {
          p = 100;
        }
        $(`.progress-bar${_.size(status)}`)
          .css({ width: `${p}%` })
          .text(parseFloat(p).toFixed(2));
      })
      .catch(() => {
        $(".progress-bar").addClass("progress-bar-error");
        alert("処理に失敗しました");
      })
      .then((result) => {
        $(".progress-bar").addClass("progress-bar-success");
        $("#result").text(result.text);
      });
  }
  $("#form").on("submit", doOcrSubmit);
  if (ocrSubmitBtn) {
    ocrSubmitBtn.addEventListener('click', doOcrSubmit);
  }
});

