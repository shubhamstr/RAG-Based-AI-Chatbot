const statusEl = document.getElementById('status');
const checkBtn = document.getElementById('check-btn');

async function checkHealth() {
  statusEl.className = 'status-indicator';
  statusEl.textContent = 'Checking server status...';

  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    statusEl.className = 'status-indicator success';
    statusEl.textContent = `Online: ${data.message} (${data.timestamp})`;
  } catch (err) {
    statusEl.className = 'status-indicator error';
    statusEl.textContent = `Error connecting to server: ${err.message}`;
  }
}

checkBtn.addEventListener('click', checkHealth);

// Run initial check on load
checkHealth();

