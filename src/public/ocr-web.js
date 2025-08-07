// JS for /public/image-playground.html

import $ from 'jquery';
import _ from 'lodash';


// --- Drop area logic for form (OCR) using jQuery ---
$(function () {
  var $formDropArea = $('#form-drop-area');
  var $formFileInput = $('#file');
  var $formPreview = $('#form-image-preview');

  if ($formDropArea.length && $formFileInput.length && $formPreview.length) {
    var dragEvents = 'dragenter dragover dragleave drop';
    $formDropArea.on(dragEvents, function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    $formDropArea.on('dragenter dragover', function () {
      $formDropArea.addClass('border-blue-500');
    });
    $formDropArea.on('dragleave drop', function () {
      $formDropArea.removeClass('border-blue-500');
    });
    $formDropArea.on('click', function () {
      $formFileInput.trigger('click');
    });
    $formDropArea.on('drop', function (e) {
      var files = e.originalEvent.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files, $formPreview, $formFileInput);
      }
    });
    $formFileInput.on('change', function (e) {
      handleFiles(e.target.files, $formPreview);
    });
    $(document).on('paste', function (e) {
      if (e.originalEvent.clipboardData && e.originalEvent.clipboardData.items) {
        var items = e.originalEvent.clipboardData.items;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.type.startsWith('image/')) {
            var file = item.getAsFile();
            handleFiles([file], $formPreview, $formFileInput);
            e.preventDefault();
            break;
          }
        }
      }
    });
  }

  function handleFiles(files, $previewEl, $fileInputEl) {
    var file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please drop an image file.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      $previewEl.attr('src', e.target.result).removeClass('hidden');
    };
    reader.readAsDataURL(file);
    // If file input is provided, set the file (for form submit)
    if ($fileInputEl && $fileInputEl.length) {
      var dt = new DataTransfer();
      dt.items.add(file);
      $fileInputEl[0].files = dt.files;
    }
  }


$("#form").on("submit", (e) => {
  e.preventDefault();

  const file_list = $("#file").prop("files");
  if (_.isEmpty(file_list)) {
    alert("file Empty");
    return;
  }
  const file = file_list[0];
  if (file.type.indexOf("image") === -1) {
    alert("Image");
    return;
  }

  let status = {};
  Tesseract.recognize(file, { lang: $("#lang").val() })
    .progress((result) => {
      let p = result.progress * 100;
      if (!status[result.status]) {
        status[result.status] = true;
        $("#progress").append(`
          <p class="mb-1 text-sm font-medium text-blue-700">${result.status}</p>
          <div class="w-full bg-gray-200 rounded-full h-3.5 mb-4 dark:bg-gray-700">
            <div class="progress-bar progress-bar${_.size(status)} bg-blue-600 h-3.5 rounded-full text-xs text-white flex items-center justify-center transition-all duration-300" style="width:0%"></div>
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
});
});

