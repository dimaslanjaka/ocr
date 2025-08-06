document.getElementById('urlForm').addEventListener('submit', async function(e) {
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
        function showLoading() {
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('result').classList.add('hidden');
        }
        function hideLoading() {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('result').classList.remove('hidden');
        }
        function showResult(text) {
            document.getElementById('result').textContent = text || 'No text found in the image.';
            clearMessages();
        }
        function showError(message) {
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
            document.getElementById('result').parentNode.insertBefore(alertDiv, document.getElementById('result'));
        }
        function showSuccess(message) {
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
            document.getElementById('result').parentNode.insertBefore(alertDiv, document.getElementById('result'));
        }
        function clearMessages() {
            const alerts = document.querySelectorAll('.bg-red-50, .bg-green-50');
            alerts.forEach(alert => alert.remove());
        }
