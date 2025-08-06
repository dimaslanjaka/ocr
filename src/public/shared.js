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
  for (const line of text.split('\n')) {
    const vouchers = extractVoucherCodes(line);
  }
  document.getElementById('result').textContent = text || 'No text found in the image.';
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
