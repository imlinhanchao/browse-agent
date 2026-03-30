import type { Command, CommandResponse } from '@anthropic/browse-agent-shared';
import { DEFAULT_PORT } from '@anthropic/browse-agent-shared';
import { WSClient } from './ws-client';
import {
  handleNavigate,
  handleGetContent,
  handleListTabs,
  handleCloseTab,
  handleInjectScript,
  handleInjectCSS,
  handleGetDOM,
  handleEvaluate,
  handleScreenshot,
} from './handlers';

let wsClient: WSClient | null = null;
console.log('[BrowseAgent] Service worker loaded');

// --------------------------------------------------------
// Command dispatcher
// --------------------------------------------------------
async function executeCommand(command: Command): Promise<unknown> {
  switch (command.type) {
    case 'navigate':
      return handleNavigate(command);
    case 'getContent':
      return handleGetContent(command);
    case 'listTabs':
      return handleListTabs();
    case 'closeTab':
      return handleCloseTab(command);
    case 'injectScript':
      return handleInjectScript(command);
    case 'injectCSS':
      return handleInjectCSS(command);
    case 'getDOM':
      return handleGetDOM(command);
    case 'evaluate':
      return handleEvaluate(command);
    case 'screenshot':
      return handleScreenshot(command);
    default:
      throw new Error(`Unknown command type: ${(command as any).type}`);
  }
}

// --------------------------------------------------------
// Initialize WebSocket connection
// --------------------------------------------------------
async function initConnection() {
  const stored = await chrome.storage.local.get(['wsUrl', 'secret']);
  const wsUrl = stored.wsUrl || `ws://127.0.0.1:${DEFAULT_PORT}`;
  const secret = stored.secret || 'my-secure-secret-change-me';

  if (!secret) {
    console.warn('[BrowseAgent] No secret configured. Open extension popup to set connection settings.');
    return;
  }

  wsClient = new WSClient(wsUrl, secret);

  wsClient.setCommandHandler(async (payload, requestId) => {
    let response: CommandResponse;
    try {
      const data = await executeCommand(payload.command);
      response = { success: true, requestId, data };
    } catch (err) {
      response = {
        success: false,
        requestId,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    await wsClient!.sendResponse(requestId, {
      type: 'commandResponse',
      response,
    });
  });

  try {
    await wsClient.connect();
    console.log('[BrowseAgent] Connected to server:', wsUrl);
  } catch (err) {
    console.error('[BrowseAgent] Failed to connect:', err);
  }
}

// --------------------------------------------------------
// Lifecycle
// --------------------------------------------------------

// Start connection on install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[BrowseAgent] Extension installed');
  initConnection();
});

chrome.runtime.onStartup.addListener(() => {
  initConnection();
});

// Re-init when settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.wsUrl || changes.secret)) {
    console.log('[BrowseAgent] Settings changed, reconnecting...');
    wsClient?.disconnect();
    initConnection();
  }
});

// Keepalive alarm to prevent service worker from dying
chrome.alarms.create('ws-keepalive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'ws-keepalive') {
    if (wsClient?.isConnected && wsClient?.isAuthenticated) {
      try {
        await wsClient.send({ type: 'ping' });
      } catch {
        // Will reconnect automatically
      }
    } else if (!wsClient?.isConnected) {
      initConnection();
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getStatus') {
    sendResponse({
      connected: wsClient?.isConnected ?? false,
      authenticated: wsClient?.isAuthenticated ?? false,
    });
  } else if (message.type === 'reconnect') {
    wsClient?.disconnect();
    initConnection().then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  return false;
});

// Auto-connect on load
initConnection();
