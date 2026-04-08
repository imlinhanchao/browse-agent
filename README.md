English / [简体中文](README.zh-CN.md)

# Browse Agent

A browser automation toolkit consisting of a **Chrome extension** and an **npm SDK** that communicate via authenticated WebSocket.

## Architecture

```
┌──────────────────┐     WebSocket (HMAC Auth)     ┌──────────────────┐
│   Your Node.js   │◄─────────────────────────────►│ Chrome Extension │
│   Application    │    Commands & Responses       │ (Service Worker) │
│  (browse-agent-  │                               │                  │
│       sdk)       │                               │  ┌───────────────┤
│                  │                               │  │ Content Script│
└──────────────────┘                               └──┴───────────────┘
                                                          │
                                                    ┌─────▼─────┐
                                                    │  Browser  │
                                                    │   Tabs    │
                                                    └───────────┘
```

## Features

| Capability | Method |
|---|---|
| Open URL & get response | `agent.navigate(url)` / `agent.getContent()` |
| Inject JavaScript | `agent.injectScript(code)` / `agent.evaluate(expr)` |
| Inject CSS | `agent.injectCSS(code)` |
| Query DOM | `agent.getDOM(selector)` |
| Full-page screenshot | `agent.screenshotFullPage()` |
| Viewport screenshot | `agent.screenshotVisible()` |
| Area screenshot | `agent.screenshotArea({ x, y, width, height })` |
| List / close tabs | `agent.listTabs()` / `agent.closeTab(id)` |

## Security

Communication between the SDK and extension supports two modes:

- Shared-secret mode: **HMAC-SHA256 mutual authentication**
- No-secret mode: handshake without HMAC signatures

Shared-secret mode flow:

1. Server sends a random challenge to the extension
2. Extension signs the challenge with the shared secret and sends back its own challenge
3. Server verifies the HMAC, signs the extension's challenge, and sends acknowledgement
4. Extension verifies the server's HMAC — mutual authentication complete
5. All subsequent messages include HMAC signatures and timestamps (replay protection)

When secret is empty on both sides, authentication still completes, but HMAC checks are skipped.

Only `127.0.0.1` connections are accepted by the WebSocket server.

## Project Structure

```
browse-agent/
├── .github/workflows/
│   └── release-extension-draft.yml  # Manual action: build + draft release
├── packages/
│   ├── shared/          # Shared types, protocol, HMAC utilities
│   ├── extension/       # Chrome MV3 extension
│   │   └── build/       # Built extension (load this in Chrome)
│   └── sdk/             # npm library for Node.js
├── examples/
│   └── basic-usage.mjs  # Usage example
├── package.json         # Workspace root
└── tsconfig.base.json
```

## Quick Start

### Build

```bash
npm install
npm run build
```

### Load the Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `packages/extension/build/` directory

### Configure the Extension

1. Click the Browse Agent extension icon in Chrome toolbar
2. Set **WebSocket URL**: `ws://127.0.0.1:9315` (default)
3. Set **Shared Secret**: optional (leave empty to use no-secret handshake)
4. Click **Save**

### Use the SDK

```typescript
import { BrowserAgent } from 'browse-agent-sdk';

const agent = new BrowserAgent({
  // Optional: set to '' (or omit) for no-secret handshake
  secret: 'same-secret-as-extension',
  port: 9315,
});

await agent.start();
await agent.waitForConnection();

// Navigate to a page
const result = await agent.navigate('https://example.com');
console.log(result.title); // "Example Domain"

// Get page text
const content = await agent.getContent({ format: 'text' });
console.log(content.content);

// Take a full page screenshot
const screenshot = await agent.screenshotFullPage();
// screenshot.data is base64-encoded PNG

// Inject JavaScript
const evalResult = await agent.evaluate('document.querySelectorAll("a").length');
console.log(evalResult.result); // number of links

// Inject CSS
await agent.injectCSS('body { background: yellow !important; }');

// Query DOM elements
const headings = await agent.getDOM('h1', { property: 'innerText', all: true });
console.log(headings.elements); // ["Example Domain"]

// Clean up
await agent.stop();
```

### Run the Example

```bash
node examples/basic-usage.mjs
```

## Browse Agent Skill

You can call the built-in skill at `skills/browse-agent` from any AI assistant that supports loading local Skills in the current workspace.

1. Open your AI assistant in this repository, or import `skills/browse-agent` as a Skill module.
  - Make sure your assistant supports local Skills (for example, AgentGPT, LangSmith, LangAgent, etc.).
  - Or keep the current workspace at this repository so the assistant can discover the local skill.

2. Trigger the skill in either way (depends on your assistant UI):

  - Slash command style: `/browse-agent <your task description>`
  - Natural language: describe a web browsing task directly (for example: "visit a URL and extract page text")

  Example prompts:

  - `/browse-agent Visit https://example.com and return title + main text`
  - `Open https://news.ycombinator.com and list the first 10 post titles`
  - `Take a full-page screenshot of https://example.com and save it`

3. Review the returned output.

  The skill returns structured data for your task (for example `title`, `url`, `content`, screenshot metadata, or DOM query results).

> [!NOTE] Initialization
> On first use, the skill workflow should prepare dependencies automatically.
> If your environment blocks that step or initialization fails, run this fallback manually: `node skills/browse-agent/scripts/setup.mjs`
> This command installs `browse-agent-sdk` and downloads the extension to `.browse-agent/extension/`.

## API Reference

### `BrowserAgent(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `secret` | `string` | `''` | Optional shared HMAC secret |
| `port` | `number` | `9315` | WebSocket server port |
| `host` | `string` | `127.0.0.1` | WebSocket server host |
| `timeout` | `number` | `30000` | Default command timeout (ms) |

### Navigation

- **`navigate(url, options?)`** — Open a URL in a new tab
- **`getContent(options?)`** — Get page HTML or text content
- **`listTabs()`** — List all open tabs
- **`closeTab(tabId)`** — Close a specific tab

### Injection

- **`injectScript(code, tabId?)`** — Execute JavaScript in the page
- **`injectCSS(code, tabId?)`** — Inject CSS styles
- **`evaluate(expression, tabId?)`** — Evaluate a JS expression and return result
- **`getDOM(selector, options?)`** — Query DOM elements by CSS selector

### Screenshots

- **`screenshotFullPage(options?)`** — Capture entire scrollable page
- **`screenshotVisible(options?)`** — Capture visible viewport
- **`screenshotArea(clip, options?)`** — Capture a specific region
- **`screenshot(options)`** — Generic screenshot method

## Development

```bash
# Watch mode for extension
npm run dev:extension

# Build everything
npm run build

# Build one package
npm run build:shared
npm run build:sdk
npm run build:extension

# Clean dist folders under packages/*
npm run clean

# Clean extension build output
npm run clean -w packages/extension
```
