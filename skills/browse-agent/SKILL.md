---
name: browse-agent
description: "Browse web pages and extract data using a real Chrome browser controlled via browse-agent-sdk. Use when: AI needs to visit a URL, read webpage content, scrape data, take page screenshots, query DOM elements, run JavaScript on live pages, get page text or HTML, or interact with web applications. Triggers: 'browse website', 'visit URL', 'scrape page', 'get web content', 'screenshot page', 'extract from website', 'read webpage', 'open URL', 'web data'."
argument-hint: "URL to visit, or describe what data to extract from the web"
---

# Browse Agent — Web Browsing & Data Extraction

Control a real Chrome browser to visit web pages, extract content, take screenshots, query DOM elements, and run JavaScript — all via `browse-agent-sdk`.

## Prerequisites

- Node.js 18+
- One of: Google Chrome, Chromium, Microsoft Edge, or Brave Browser

## Setup (One-Time)

Run the [setup script](./scripts/setup.mjs) **from the project root**:

```bash
node skills/browse-agent/scripts/setup.mjs
```

This installs `browse-agent-sdk` from npm and downloads the Chrome extension from the [latest release](https://github.com/imlinhanchao/browse-agent/releases/latest) into `.browse-agent/extension/`.

The setup script checks existing installation state before doing any work:

- If `.browse-agent/extension/manifest.json` exists and `browse-agent-sdk` is already present in `node_modules`, it exits immediately.
- If only one part is missing, it installs only the missing SDK or extension step.

## Usage Procedure

### Step 1: Write a Browsing Script

Create a **temporary** `.mjs` file (e.g., `_browse_task.mjs`) using the template below. The [browse launcher](./scripts/browse.mjs) handles all browser lifecycle automatically — just write your browsing logic.

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';

await browse(async (agent) => {
  // --- Your browsing logic here ---
  await agent.navigate('https://example.com');
  const content = await agent.getContent({ format: 'text' });

  // Return a value to print it as JSON to stdout
  return {
    url: content.url,
    title: content.title,
    content: content.content,
  };
});
```

The `browse(task, options?)` function:
1. Starts the WebSocket server
2. Patches and loads the extension (default: no shared secret handshake)
3. Launches the browser (auto-detects executable)
4. Waits for the extension to connect
5. Runs your `task(agent)` callback
6. Returns value as JSON to stdout
7. Kills the browser and cleans up

It also returns the callback value as the resolved Promise result.

**Options** (passed as second argument or via env vars):

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

```javascript
// Example: use Edge with user profile
await browse(async (agent) => { /* ... */ }, {
  browser: 'edge',
  useUserProfile: true,
});

// Example: return result without printing JSON to stdout
const data = await browse(async (agent) => {
  await agent.navigate('https://example.com');
  return { title: 'ok' };
}, {
  printResult: false,
});
```

### Step 2: Run the Script

```bash
node _browse_task.mjs 2>/dev/null
```

Override via environment variable:

```bash
# Use user's default Chrome profile (keeps login sessions)
USE_USER_PROFILE=true node _browse_task.mjs 2>/dev/null

# Use Edge with user profile
BROWSER=edge USE_USER_PROFILE=true node _browse_task.mjs 2>/dev/null

# Custom executable path
CHROME_PATH=/path/to/browser node _browse_task.mjs 2>/dev/null
```

- **stdout**: Result JSON, but some SDK logs may also appear on stdout depending on environment
- **stderr**: Most diagnostic logs

Use `2>/dev/null` to suppress logs when only data is needed. Omit it when debugging.

### Step 3: Parse Output and Clean Up

Prefer one of these parsing strategies:

- Parse the first complete JSON object from stdout (ignore non-JSON log lines)
- Or keep script output JSON-only (return final data from `browse(...)` callback and avoid extra `console.log` outside)
- Or set `printResult: false` and handle the returned value in code instead of parsing stdout

Then delete the temporary script file when done.

## Modular Scripts

All functionality is also available as individual modules for fine-grained control. Import from `./skills/browse-agent/scripts/`.

### Lifecycle Scripts

| Script | Export | Description |
|--------|--------|-------------|
| [launch-browser.mjs](./scripts/launch-browser.mjs) | `launchBrowser(options?)` | Start browser with extension. Returns session object |
| [connect.mjs](./scripts/connect.mjs) | `connect(options?)` | Connect to a running browser session. Returns agent |
| [close-browser.mjs](./scripts/close-browser.mjs) | `closeBrowser(agent?)` | Kill browser, stop agent, clean up temp files |

### Feature Scripts

| Script | Export | Description |
|--------|--------|-------------|
| [navigate.mjs](./scripts/navigate.mjs) | `navigate(agent, url, opts?)` | Open URL → `{ tabId, url, title }` |
| [get-content.mjs](./scripts/get-content.mjs) | `getContent(agent, opts?)` | Get page HTML/text → `{ content, url, title }` |
| [get-dom.mjs](./scripts/get-dom.mjs) | `getDOM(agent, selector, opts?)` | Query DOM elements → `{ result }` |
| [evaluate.mjs](./scripts/evaluate.mjs) | `evaluate(agent, expression, opts?)` | Run JS expression → `{ result }` |
| [inject-script.mjs](./scripts/inject-script.mjs) | `injectScript(agent, code, opts?)` | Execute JS code → `{ success }` |
| [inject-css.mjs](./scripts/inject-css.mjs) | `injectCSS(agent, code, opts?)` | Inject CSS → `{ success }` |
| [screenshot.mjs](./scripts/screenshot.mjs) | `screenshot(agent, mode, opts?)` | Capture screenshot → `{ data, format, width, height }` |
| [tabs.mjs](./scripts/tabs.mjs) | `listTabs(agent)` / `closeTab(agent, id)` / `activateTab(agent, id)` | Tab management |

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

All modules are also re-exported from [browse.mjs](./scripts/browse.mjs) for convenience:

```javascript
import { launchBrowser, navigate, getContent, screenshot, closeBrowser } from './skills/browse-agent/scripts/browse.mjs';
```

## API Reference

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

## Examples

### Extract Text from a Page

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://example.com');
  const result = await agent.getContent({ format: 'text', tabId });
  return { title: result.title, text: result.content };
});
```

### Query DOM Elements

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://news.ycombinator.com');
  const titles = await agent.getDOM('.titleline > a', {
    property: 'innerText',
    all: true,
    tabId,
  });
  return { headlines: titles.result };
});
```

### Run JavaScript on the Page

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://example.com');
  const count = await agent.evaluate('document.querySelectorAll("a").length', tabId);
  return { linkCount: count.result };
});
```

### Take a Screenshot

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';
import { writeFileSync } from 'fs';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://example.com');
  const shot = await agent.screenshotVisible({ format: 'png', tabId });
  writeFileSync('screenshot.png', Buffer.from(shot.data, 'base64'));
  return { saved: 'screenshot.png', width: shot.width, height: shot.height };
});
```

### Multi-Page Data Collection

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';

await browse(async (agent) => {
  const urls = ['https://example.com', 'https://example.org'];
  const results = [];
  for (const url of urls) {
    const { tabId } = await agent.navigate(url);
    const page = await agent.getContent({ format: 'text', tabId });
    results.push({ url: page.url, title: page.title, content: page.content });
    const tabs = await agent.listTabs();
    const tab = tabs.tabs.find(t => t.url === url);
    if (tab) await agent.closeTab(tab.id);
  }
  return results;
});
```

### Access Logged-in Content (User Profile)

```javascript
import { browse } from './skills/browse-agent/scripts/browse.mjs';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://github.com/notifications');
  const content = await agent.getContent({ format: 'text', tabId });
  return { title: content.title, content: content.content };
}, { useUserProfile: true });
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Browser not found | Set `CHROME_PATH` env var to the executable path, or use `BROWSER=edge\|chromium\|brave` |
| Profile locked | Close all existing browser windows first when using `USE_USER_PROFILE=true` |
| Connection timeout (30s) | Ensure port 9315 is free. Kill stale Chrome: `pkill -f "user-data-dir=.*browse-agent"` |
| Extension not loading | Verify `.browse-agent/extension/manifest.json` exists. Re-run setup script |
| CSP blocks script injection | Use `evaluate()` instead — it uses CDP to bypass Content Security Policy |
| Stale Chrome profile | Delete `.browse-agent/chrome-profile/` and retry |
