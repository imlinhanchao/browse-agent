# browse-agent-sdk

Node.js SDK for controlling Chrome through the Browse Agent companion extension.

`browse-agent-sdk` runs a local WebSocket server in your Node.js app. The extension connects to it, authenticates (with or without a shared secret), and executes browser commands.

## Installation

```bash
npm install browse-agent-sdk
```

## Before You Start

This SDK requires the **Browse Agent Chrome extension**.

1. Install/load the Browse Agent extension in Chrome.
2. Open the extension popup and configure:
- WebSocket URL: `ws://127.0.0.1:9315`
- Shared Secret: optional. If set, it must match your SDK code.

Without the extension connection, SDK commands will not execute.

## Quick Start

```ts
import { BrowserAgent } from 'browse-agent-sdk';

const agent = new BrowserAgent({
  secret: 'replace-with-your-shared-secret',
  port: 9315,
});

try {
  await agent.start();
  await agent.waitForConnection(60000);

  const nav = await agent.navigate('https://example.com');
  const title = await agent.evaluate('document.title', nav.tabId);
  console.log('Page title:', title.result);
} finally {
  await agent.stop();
}
```

## Common Flow

```ts
const nav = await agent.navigate('https://example.com');

const content = await agent.getContent({ tabId: nav.tabId, format: 'text' });
console.log(content.content.slice(0, 200));

await agent.injectCSS('body { outline: 4px solid #00bcd4; }', nav.tabId);

const screenshot = await agent.screenshotVisible({ tabId: nav.tabId, format: 'png' });
console.log('base64 length:', screenshot.data.length);
```

## BrowserAgent Options

| Option | Type | Default | Description |
|---|---|---|---|
| `secret` | `string` | `''` | Optional shared HMAC secret used by SDK and extension |
| `port` | `number` | `9315` | WebSocket server port |
| `host` | `string` | `127.0.0.1` | WebSocket server host |
| `timeout` | `number` | `30000` | Default command timeout (ms) |

## API Reference

### Lifecycle

- `start()` - Start the SDK WebSocket server
- `waitForConnection(timeout?)` - Wait until extension authenticates
- `stop()` - Stop server and close all connections
- `isConnected` - Connection/authentication state
- `onDisconnected(cb)` - Register disconnect callback

### Navigation

- `navigate(url, options?)`
- `getContent(options?)`
- `listTabs()`
- `activateTab(tabId)`
- `closeTab(tabId)`

### Page Execution

- `injectScript(code, tabId?)`
- `injectCSS(code, tabId?)`
- `evaluate(expression, tabId?)`
- `getDOM(selector, options?)`

### Screenshots

- `screenshotFullPage(options?)`
- `screenshotVisible(options?)`
- `screenshotArea(clip, options?)`
- `screenshot(options)`

### Low-level

- `sendCommand(command, timeout?)` - Send a raw protocol command to the extension

## Troubleshooting

- `waitForConnection()` timeout:
- Confirm extension is installed and enabled.
- Confirm WebSocket URL matches your SDK config.
- If using a shared secret, confirm extension and SDK values match.
- Confirm your app is running and has called `await agent.start()`.
- Commands fail after connection:
- Confirm the target tab still exists.
- Use `listTabs()` to inspect available tabs and IDs.

## Security Notes

- The default host is localhost (`127.0.0.1`).
- SDK and extension can authenticate without a secret, or with HMAC shared-secret mode.
- If using shared-secret mode, use a strong secret and avoid committing it to source control.
