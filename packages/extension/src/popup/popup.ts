const wsUrlInput = document.getElementById('wsUrl') as HTMLInputElement;
const secretInput = document.getElementById('secret') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const reconnectBtn = document.getElementById('reconnectBtn') as HTMLButtonElement;
const connStatus = document.getElementById('connStatus') as HTMLSpanElement;
const authStatus = document.getElementById('authStatus') as HTMLSpanElement;
const messageDiv = document.getElementById('message') as HTMLDivElement;

function showMessage(text: string, type: 'success' | 'error') {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.hidden = false;
  setTimeout(() => { messageDiv.hidden = true; }, 3000);
}

function updateStatus(connected: boolean, authenticated: boolean) {
  connStatus.textContent = connected ? 'Connected' : 'Disconnected';
  connStatus.className = `badge ${connected ? 'connected' : 'disconnected'}`;

  authStatus.textContent = authenticated ? 'Authenticated' : 'Not authenticated';
  authStatus.className = `badge ${authenticated ? 'connected' : 'disconnected'}`;
}

// Load saved settings
chrome.storage.local.get(['wsUrl', 'secret'], (result) => {
  wsUrlInput.value = result.wsUrl || '';
  secretInput.value = result.secret || '';
});

// Check current status
chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
  if (response) {
    updateStatus(response.connected, response.authenticated);
  }
});

// Save settings
saveBtn.addEventListener('click', () => {
  const wsUrl = wsUrlInput.value.trim();
  const secret = secretInput.value;

  chrome.storage.local.set({ wsUrl, secret }, () => {
    showMessage('Settings saved', 'success');
  });
});

// Reconnect
reconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'reconnect' }, (response) => {
    if (response?.ok) {
      showMessage('Reconnecting...', 'success');
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'getStatus' }, (r) => {
          if (r) updateStatus(r.connected, r.authenticated);
        });
      }, 1500);
    }
  });
});
