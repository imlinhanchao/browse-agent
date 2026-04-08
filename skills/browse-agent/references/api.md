# API Reference

## Agent Methods

| Method | Description | Result |
|--------|-------------|--------------------------|
| `navigate(url, opts?)` | Open URL in new tab. `opts: { waitForLoad?, timeout? }` | `{ tabId, url, title }` |
| `getContent(opts?)` | Get page content. `opts: { format: 'html'\|'text', tabId? }` | `{ content, url, title }` |
| `getDOM(selector, opts?)` | Query DOM. `opts: { property?: 'outerHTML'\|'innerHTML'\|'innerText', all?, tabId? }` | `{ result }` |
| `evaluate(expression, tabId?)` | Run JS expression, return value. | `{ result }` |
| `injectScript(code, tabId?)` | Execute JS code block. | `{ success }` |
| `injectCSS(code, tabId?)` | Inject CSS stylesheet. | `{ success }` |
| `screenshotVisible(opts?)` | Capture viewport. `opts: { format?, quality?, tabId? }` | `{ data (base64), format, width, height }` |
| `screenshotFullPage(opts?)` | Capture full page. `opts: { format?, quality?, tabId? }` | `{ data (base64), format, width, height }` |
| `screenshotArea(clip, opts?)` | Capture region. `clip: { x, y, width, height }` `opts: { format?, quality?, tabId? }` | `{ data (base64), format, width, height }` |
| `listTabs()` | List all open tabs | `{ tabs: [{ id, url, title, active }] }` |
| `closeTab(tabId)` | Close a tab | — |
| `activateTab(tabId)` | Switch to a tab | — |

All methods return direct result objects (for example `{ result }`, `{ content, url, title }`, `{ tabs }`).

## Modular Scripts

All functionality is also available as individual modules for fine-grained control. Import from `./skills/browse-agent/scripts/`.

### Lifecycle Scripts

| Script | Export | Description |
|--------|--------|-------------|
| [launch-browser.mjs](../scripts/launch-browser.mjs) | `launchBrowser(options?)` | Start browser with extension. Returns session object |
| [connect.mjs](../scripts/connect.mjs) | `connect(options?)` | Connect to a running browser session. Returns agent |
| [close-browser.mjs](../scripts/close-browser.mjs) | `closeBrowser(agent?)` | Kill browser, stop agent, clean up temp files |
| [clear.mjs](../scripts/clear.mjs) | `clear(options?)` | Remove installation, dependencies, and session data |

### Feature Scripts

| Script | Export | Description |
|--------|--------|-------------|
| [navigate.mjs](../scripts/navigate.mjs) | `navigate(agent, url, opts?)` | Open URL → `{ tabId, url, title }` |
| [get-content.mjs](../scripts/get-content.mjs) | `getContent(agent, opts?)` | Get page HTML/text → `{ content, url, title }` |
| [get-dom.mjs](../scripts/get-dom.mjs) | `getDOM(agent, selector, opts?)` | Query DOM elements → `{ result }` |
| [evaluate.mjs](../scripts/evaluate.mjs) | `evaluate(agent, expression, opts?)` | Run JS expression → `{ result }` |
| [inject-script.mjs](../scripts/inject-script.mjs) | `injectScript(agent, code, opts?)` | Execute JS code → `{ success }` |
| [inject-css.mjs](../scripts/inject-css.mjs) | `injectCSS(agent, code, opts?)` | Inject CSS → `{ success }` |
| [screenshot.mjs](../scripts/screenshot.mjs) | `screenshot(agent, mode, opts?)` | Capture screenshot → `{ data, format, width, height }` |
| [tabs.mjs](../scripts/tabs.mjs) | `listTabs(agent)` / `closeTab(agent, id)` / `activateTab(agent, id)` | Tab management |

### Step-by-Step Example (Modular)

```javascript
import { launchBrowser } from './skills/browse-agent/scripts/launch-browser.mjs';
import { navigate } from './skills/browse-agent/scripts/navigate.mjs';
import { getContent } from './skills/browse-agent/scripts/get-content.mjs';
import { closeBrowser } from './skills/browse-agent/scripts/close-browser.mjs';

// 1. Launch
const session = await launchBrowser({ browser: 'chrome' });
const agent = session._agent;
await agent.waitForConnection(30000);

try {
  // 2. Browse
  await navigate(agent, 'https://example.com');
  const page = await getContent(agent, { format: 'text' });
  console.log(JSON.stringify(page, null, 2));
} finally {
  // 3. Clean up
  await closeBrowser(agent);
}
```

All modules are also re-exported from [browse.mjs](../scripts/browse.mjs) for convenience:

```javascript
import { launchBrowser, navigate, getContent, screenshot, closeBrowser } from './skills/browse-agent/scripts/browse.mjs';
```

## Browse Options

Options passed as second argument to `browse()` or via env vars:

| Option / Env Var | Values | Default | Description |
|---|---|---|---|
| `browser` / `BROWSER` | `chrome`, `chromium`, `edge`, `brave` | `chrome` | Browser to launch |
| `headless` / `HEADLESS` | `true`, `false` | `false` | Run without visible window |
| `useUserProfile` / `USE_USER_PROFILE` | `true`, `false` | `false` | Use default browser profile (keeps login sessions, cookies). ⚠ Close the browser first! |
| `port` / `BROWSE_AGENT_PORT` | number | `9315` | WebSocket port |
| `timeout` / `CONNECTION_TIMEOUT` | ms | `30000` | Connection timeout |
| `secret` / `SHARED_SECRET` | string | `''` | Optional shared secret. Empty uses no-secret handshake |
| `printResult` | `true`, `false` | `true` | Print callback return value to stdout as JSON |
| — / `CHROME_PATH` | path | — | Custom browser executable path |
