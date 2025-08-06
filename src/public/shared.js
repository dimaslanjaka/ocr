// Shared UI helper functions for public JS files

export function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = '';
}

export function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
}

export function showResult(text) {
    const result = document.getElementById('result');
    if (result) {
        result.textContent = text;
        result.style.display = '';
    }
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
