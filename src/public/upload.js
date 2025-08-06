// File upload form handler
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
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
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.jobId) {
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
        async function pollOcrResult(jobId, filename) {
            let tries = 0;
            // Remove maxTries, poll forever until job is done or failed
            while (true) {
                try {
                    const res = await fetch(`/result/${jobId}`);
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
                await new Promise(r => setTimeout(r, 2000));
                tries++;
            }
        }
        document.getElementById('imageFile').addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name;
            const fileNameDiv = document.getElementById('fileName');
            if (fileName) {
                fileNameDiv.textContent = `Selected: ${fileName}`;
                fileNameDiv.className = 'text-sm text-green-600 text-center';
            } else {
                fileNameDiv.textContent = '';
            }
        });
        document.addEventListener('DOMContentLoaded', function() {
            const dropArea = document.getElementById('dropArea');
            const fileInput = document.getElementById('imageFile');
            ['dragenter', 'dragover'].forEach(eventName => {
                dropArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropArea.classList.add('border-blue-400', 'bg-blue-50');
                });
            });
            ['dragleave', 'drop'].forEach(eventName => {
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
                    fileInput.dispatchEvent(new Event('change'));
                }
            });
        });
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
