// Shared UI helper functions for public JS files

export function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');
}

export function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('result').classList.remove('hidden');
}

export function showResult(text) {
    document.getElementById('result').textContent = text || 'No text found in the image.';
    clearMessages();
}

export function showError(message) {
    clearMessages();
    const alertDiv = document.createElement('div');
    alertDiv.className = 'flex flex-col items-start p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 w-full box-border max-w-full overflow-x-auto';
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

export function showSuccess(message) {
    clearMessages();
    const alertDiv = document.createElement('div');
    alertDiv.className = 'flex flex-col items-start p-4 mb-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50 w-full box-border max-w-full overflow-x-auto';
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

export function clearMessages() {
    const ids = ['error', 'success', 'result'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '';
            el.style.display = 'none';
        }
    });
}
