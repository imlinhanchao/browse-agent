---
name: browse-agent
description: "Browse web pages and extract data using a real Chrome browser controlled via browse-agent-sdk. Use when: AI needs to visit a URL, read webpage content, scrape data, take page screenshots, query DOM elements, run JavaScript on live pages, get page text or HTML, or interact with web applications. Triggers: 'browse website', 'visit URL', 'scrape page', 'get web content', 'screenshot page', 'extract from website', 'read webpage', 'open URL', 'web data'."
argument-hint: "URL to visit, or describe what data to extract from the web"
---

# Browse Agent — Web Browsing & Data Extraction

Control a real Chrome browser to visit web pages, extract content, take screenshots, query DOM elements, and run JavaScript.

## Prerequisites

- Node.js 18+
- One of: Google Chrome, Chromium, Microsoft Edge, or Brave Browser

## Setup (One-Time)

```bash
browse-agent setup
```

`setup` now opens the Chrome Web Store page in the selected browser and waits for installation detection.

Important for AI agents:
- Always remind the user to run `browse-agent setup` before first use.
- Explicitly remind the user to click **Add to Chrome** on the Web Store page (installation cannot be silent in normal user environments).
- `setup` exits immediately if it detects the extension is already installed.
- Do NOT use `--headless` unless the user explicitly asks for headless/silent/background mode. Default launch should always open a visible browser window.

## Usage Procedure — Step-by-Step (Recommended)

Browse **interactively** — one command per step. Observe each result before deciding the next action, just like a human browsing.

### Step 1: Launch Browser

```bash
browse-agent launch
```

Returns session info as JSON. The browser stays open until you close it.

### Step 2: Navigate and Explore

Run each command separately. Read the output, then decide the next action:

```bash
# Open a page — returns { tabId, url, title }
browse-agent navigate "https://example.com"

# Read the page content — returns { content, url, title }
browse-agent get-content --format text

# Specify a tab by ID (from navigate output) — use --tabId with any feature command
browse-agent get-content --format text --tabId 123

# Query specific elements — returns { result }
browse-agent get-dom "h1" --property innerText

# Run JavaScript — returns { result }
browse-agent evaluate "document.title"

# Take a screenshot — returns { data (base64), format, width, height }
browse-agent screenshot visible
```

**Key principle**: Each command outputs JSON to stdout. Use `--tabId <id>` to target a specific tab (ID comes from `navigate` or `tabs list` output). Parse the output, reason about it, then choose the next command. Don't pre-plan the entire interaction.

### Step 3: Close Browser

```bash
browse-agent close
```

### Typical Interaction Flow

```
launch → navigate URL → get-content (read page) → get-dom (extract specific data)
       → navigate another URL → get-content → ...
       → close
```

Each step is independent. If the page content isn't what you expected, you can navigate elsewhere, try different selectors, or run JavaScript to interact with the page — all based on what you see.

### CLI Options

| Option | Applies to | Description |
|---|---|---|
| `--browser <name>` | setup, launch | `chrome` \| `chromium` \| `edge` \| `brave` (default: chrome) |
| `--headless` | launch | Run without visible window |
| `--port <number>` | launch, connect, feature cmds | WebSocket port (default: 9315) |
| `--tabId <id>` | all feature cmds | Target a specific tab (ID from `navigate` or `tabs list`) |
| `--format <type>` | get-content, screenshot | `text` \| `html` (content) or `png` \| `jpeg` (screenshot) |
| `--property <prop>` | get-dom | `outerHTML` \| `innerHTML` \| `innerText` |
| `--all` | get-dom | Return all matches instead of first only |
| `--quality <num>` | screenshot | JPEG quality 1-100 |
| `--timeout <ms>` | connect, feature cmds | Connection timeout in ms |

Run `browse-agent --help` to see all commands and options.

For full CLI commands, see [CLI Reference](./references/cli.md).

## One-Shot Script (Alternative)

When you already know the exact steps needed, use the [browse launcher](./scripts/browse.mjs) to run everything in one script:

```javascript
import { browse } from 'browse-agent-cli/script';

await browse(async (agent) => {
  await agent.navigate('https://example.com');
  const content = await agent.getContent({ format: 'text' });
  return { url: content.url, title: content.title, content: content.content };
});
```

Run with: `node _browse_task.mjs`

For full API and script examples, see [API Reference](./references/api.md) and [Examples](./references/examples.md).

## Cleanup

```bash
browse-agent clear           # remove local runtime data
```

## References

- [API Reference](./references/api.md) — Full method signatures, options, modular scripts
- [CLI Reference](./references/cli.md) — All CLI commands and options
- [Examples & Troubleshooting](./references/examples.md) — Code examples and common fixes
