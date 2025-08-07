import { getBaseUrl } from '../utils/url.js';

const baseUrl = getBaseUrl();
let latestVouchers;
async function fetchAndDisplay() {
  try {
    const res = await fetch(`${baseUrl}/get`, { method: 'POST' });
    const vouchers = await res.json();
    latestVouchers = vouchers;
    document.getElementById('output').textContent = JSON.stringify(vouchers, null, 2);
  } catch (e) {
    document.getElementById('output').textContent = 'Error: ' + e;
  }
  setTimeout(fetchAndDisplay, 3000);
}
fetchAndDisplay();

document.getElementById('downloadCsvBtn').addEventListener('click', function () {
  if (!latestVouchers) {
    alert('No vouchers to export.');
    return;
  }
  let csvContent = '';
  if (Array.isArray(latestVouchers)) {
    // Convert to CSV string (with header)
    const header = 'Voucher\n';
    csvContent = header + latestVouchers.join('\n');
  } else {
    const ws = XLSX.utils.json_to_sheet(latestVouchers);
    csvContent = XLSX.utils.sheet_to_csv(ws);
  }
  // alert(csvContent); // For debugging, remove in production
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vouchers.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
