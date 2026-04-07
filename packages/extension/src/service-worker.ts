import type { Command, CommandResponse } from 'browse-agent-shared';
import { DEFAULT_PORT } from 'browse-agent-shared';
import { WSClient } from './ws-client';
import {
  handleNavigate,
  handleGetContent,
  handleListTabs,
  handleCloseTab,
  handleActivateTab,
  handleInjectScript,
  handleInjectCSS,
  handleGetDOM,
  handleEvaluate,
  handleScreenshot,
} from './handlers';

let wsClient: WSClient | null = null;
let initInFlight: Promise<void> | null = null;
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
    case 'activateTab':
      return handleActivateTab(command);
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
async function initConnection(reason: string = 'unknown') {
  if (wsClient?.isConnected || wsClient?.isConnecting) {
    console.log(`[BrowseAgent] Skip initConnection(${reason}): client already active`);
    return;
  }

  if (initInFlight) {
    console.log(`[BrowseAgent] Skip initConnection(${reason}): init already in-flight`);
    return initInFlight;
  }

  initInFlight = (async () => {
  const stored = await chrome.storage.local.get(['wsUrl', 'secret']);
  const wsUrl = stored.wsUrl || `ws://127.0.0.1:${DEFAULT_PORT}`;
  const secret = stored.secret || 'my-secure-secret-change-me';

  if (!secret) {
    console.warn('[BrowseAgent] No secret configured. Open extension popup to set connection settings.');
    return;
  }

  const client = new WSClient(wsUrl, secret);
  wsClient = client;

  client.setCommandHandler(async (payload, requestId) => {
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

    await client.sendResponse(requestId, {
      type: 'commandResponse',
      response,
    });
  });

  try {
    await client.connect();
    if (wsClient !== client) {
      // A newer client replaced this one while it was connecting.
      client.disconnect();
      return;
    }
    console.log('[BrowseAgent] Connected to server:', wsUrl, `(reason=${reason})`);
  } catch (err) {
    console.error('[BrowseAgent] Failed to connect:', err);
  } finally {
    if (initInFlight) {
      initInFlight = null;
    }
  }
  })();

  return initInFlight;
}

// --------------------------------------------------------
// Lifecycle
// --------------------------------------------------------

// Start connection on install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[BrowseAgent] Extension installed');
  initConnection('onInstalled');
});

chrome.runtime.onStartup.addListener(() => {
  initConnection('onStartup');
});

// Re-init when settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.wsUrl || changes.secret)) {
    console.log('[BrowseAgent] Settings changed, reconnecting...');
    wsClient?.disconnect();
    wsClient = null;
    initInFlight = null;
    initConnection('settingsChanged');
  }
});

// Keepalive alarm to prevent service worker from dying
if (chrome.alarms) {
  chrome.alarms.create('ws-keepalive', { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'ws-keepalive') {
      if (wsClient?.isConnected && wsClient?.isAuthenticated) {
        try {
          await wsClient.send({ type: 'ping' });
        } catch {
          // Will reconnect automatically
        }
      } else if (!wsClient?.isConnected && !wsClient?.isConnecting) {
        initConnection('alarm');
      }
    }
  });
} else {
  console.warn('[BrowseAgent] chrome.alarms is unavailable. Add "alarms" to manifest permissions.');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getStatus') {
    sendResponse({
      connected: wsClient?.isConnected ?? false,
      authenticated: wsClient?.isAuthenticated ?? false,
    });
  } else if (message.type === 'reconnect') {
    wsClient?.disconnect();
    wsClient = null;
    initInFlight = null;
    initConnection('popupReconnect').then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  return false;
});

// Auto-connect on load
initConnection('autoLoad');
