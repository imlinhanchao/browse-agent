# browse-agent-cli

`browse-agent-cli` is an npm package that provides:

- A CLI command: `browse-agent`
- Script-style exports for Node.js: `browse-agent-cli/script`

It is designed for browser automation workflows powered by `browse-agent-sdk`.

## Installation

### Global install (recommended for CLI)

```bash
npm install -g browse-agent-cli
```

After installation:

```bash
browse-agent --help
```

### Project install (for script imports)

```bash
npm install browse-agent-cli
```

## Quick Start (CLI)

```bash
# One-time setup
browse-agent setup

# Launch browser session
browse-agent launch

# Navigate and extract
browse-agent navigate "https://example.com"
browse-agent get-content --format text

# Close session
browse-agent close
```

## CLI Commands

### Lifecycle

- `browse-agent setup`
- `browse-agent launch`
- `browse-agent connect`
- `browse-agent close`
- `browse-agent clear`

### Feature commands

- `browse-agent navigate <url>`
- `browse-agent get-content [--format text|html] [--tabId <id>]`
- `browse-agent get-dom <selector> [--property outerHTML|innerHTML|innerText] [--all] [--tabId <id>]`
- `browse-agent evaluate <expression> [--tabId <id>]`
- `browse-agent inject-script <code> [--tabId <id>]`
- `browse-agent inject-css <code> [--tabId <id>]`
- `browse-agent screenshot [visible|fullPage|area] [--format png|jpeg] [--quality <1-100>] [--tabId <id>]`
- `browse-agent tabs [list|close|activate] [tabId]`

### Skill command

- `browse-agent skill <directory>`

This command copies the package `skill` folder into:

- `<directory>/browse-agent`

Conflict behavior when target exists and is not empty:

- `overwrite`: remove and replace target folder
- `rename`: enter a new directory name, then retry
- `cancel`: abort operation

## Script Import

Import helper functions from `browse-agent-cli/script`:

```ts
import { browse } from 'browse-agent-cli/script';

await browse(async (agent) => {
  await agent.navigate('https://example.com');
  const page = await agent.getContent({ format: 'text' });
  return { title: page.title, content: page.content };
});
```

You can also import modular helpers:

```ts
import {
  launchBrowser,
  navigate,
  getContent,
  screenshot,
  closeBrowser,
} from 'browse-agent-cli/script';
```

## Common Options

- `--browser <name>`: `chrome | chromium | edge | brave`
- `--headless`
- `--port <number>`
- `--servicePort <number>`
- `--timeout <ms>`
- `--tabId <id>`

## Notes

- Node.js 18+ is required.
- One of Chrome/Chromium/Edge/Brave is required.
- For logged-in pages, ensure your browser profile/session strategy matches your environment.

## License

MIT
