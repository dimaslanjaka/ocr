// Shared UI helper functions for public JS files

import { extractVoucherCodes } from '../shared/extractVoucherCodes.js';

/**
 * Show the loading indicator and hide the result area.
 */
export function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('result').classList.add('hidden');
}

/**
 * Hide the loading indicator and show the result area.
 */
export function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('result').classList.remove('hidden');
}

/**
 * Display the OCR result text in the result area.
 * @param {string} text - The text to display. If empty, shows a default message.
 */
export function showResult(text) {
  clearMessages();
  const rootResult = document.getElementById('result');
  rootResult.innerHTML = ''; // Clear previous content

  const voucherCodes = [];
  for (const line of text.split(/\r?\n/)) {
    const vouchers = extractVoucherCodes(line, { filterBanned: true });
    if (vouchers.length > 0) {
      voucherCodes.push(...vouchers);
    }
  }

  // Create removable list of voucher codes
  if (voucherCodes.length > 0) {
    const map = voucherCodes.map((code) => ({
      text: code,
      onRemove: function (e) {
        const index = voucherCodes.indexOf(code);
        if (index > -1) {
          voucherCodes.splice(index, 1);
        }
      }
    }));

    // Wrap the removable list with a Flowbite Tailwind card
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4';
    card.innerHTML = `<h5 class="mb-2 text-lg font-bold tracking-tight text-gray-900">Voucher Codes</h5>`;
    const voucherList = createRemovableList(map);
    card.appendChild(voucherList);
    rootResult.appendChild(card);
  }

  // Create OCR text display
  const textDisplay = document.createElement('div');
  textDisplay.className = 'text-sm text-gray-700';
  textDisplay.textContent = text || 'No text found in the image.';
  rootResult.appendChild(textDisplay);
}

/**
 * Create a styled, removable list of items.
 * @param {{ text: string, onRemove: (e: MouseEvent) => void }[]} items - Array of items with display text and remove callback.
 * @returns {HTMLUListElement} The generated <ul> element containing the list items.
 */
function createRemovableList(items) {
  const list = document.createElement('ul');
  list.className = 'flex flex-wrap gap-2 my-2';
  items.forEach(({ text, onRemove }) => {
    const listItem = document.createElement('li');
    // Responsive: full width on mobile, inline-flex on larger screens
    listItem.className = 'w-full sm:w-auto inline-flex flex-col sm:flex-row items-stretch sm:items-center bg-gray-100 border border-gray-300 rounded px-3 py-1 text-sm text-gray-800 shadow-sm';

    const codeSpan = document.createElement('span');
    codeSpan.className = 'mb-2 sm:mb-0 mr-0 sm:mr-2 font-mono break-all';
    codeSpan.textContent = text;
    listItem.appendChild(codeSpan);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'self-end sm:self-auto ml-0 sm:ml-1 inline-flex items-center justify-center p-1 rounded hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400';
    removeButton.title = 'Remove';
    removeButton.onclick = function(e) {
      onRemove(e);
      // Always remove the <li> from DOM after callback
      const li = e.target.closest('li');
      if (li) li.remove();
    };

    // Font Awesome Pro trash icon
    removeButton.innerHTML = '<i class="fa-duotone fa-trash text-red-500 text-base"></i>';

    listItem.appendChild(removeButton);
    list.appendChild(listItem);
  });
  return list;
}

/**
 * Display an error message above the result area.
 * @param {string} message - The error message to display.
 */
export function showError(message) {
  clearMessages();
  const alertDiv = document.createElement('div');
  alertDiv.className =
    'flex flex-col items-start p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 w-full box-border max-w-full overflow-x-auto';
  alertDiv.innerHTML = `
        <div class="flex items-center mb-2">
            <i class="fas fa-exclamation-triangle flex-shrink-0 w-4 h-4 mr-2"></i>
            <span class="font-medium">Error!</span>
        </div>
        <div class="pl-6">${message}</div>
    `;
  const result = document.getElementById('result');
  if (result && result.parentNode) {
    result.parentNode.insertBefore(alertDiv, result);
  }
}

/**
 * Display a success message above the result area.
 * @param {string} message - The success message to display.
 */
export function showSuccess(message) {
  clearMessages();
  const alertDiv = document.createElement('div');
  alertDiv.className =
    'flex flex-col items-start p-4 mb-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50 w-full box-border max-w-full overflow-x-auto';
  alertDiv.innerHTML = `
        <div class="flex items-center mb-2">
            <i class="fas fa-check-circle flex-shrink-0 w-4 h-4 mr-2"></i>
            <span class="font-medium">Success!</span>
        </div>
        <div class="pl-6">${message}</div>
    `;
  const result = document.getElementById('result');
  if (result && result.parentNode) {
    result.parentNode.insertBefore(alertDiv, result);
  }
}

/**
 * Remove all alert messages from the UI.
 */
export function clearMessages() {
  const alerts = document.querySelectorAll('.bg-red-50, .bg-green-50');
  alerts.forEach((alert) => alert.remove());
}
