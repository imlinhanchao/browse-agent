# Examples & Troubleshooting

## Step-by-Step CLI Examples (Recommended)

### Extract Text from a Page

```bash
# 1. Launch browser
browse-agent launch

# 2. Navigate to page
browse-agent navigate "https://example.com"

# 3. Read content — decide next step based on output
browse-agent get-content --format text

# 4. Done — close browser
browse-agent close
```

### Find Specific Content on a Page

```bash
browse-agent launch
browse-agent navigate "https://news.ycombinator.com"

# First, read the page to understand structure
browse-agent get-content --format text

# Then query specific elements based on what you found
browse-agent get-dom ".titleline > a" --property innerText --all

browse-agent close
```

### Screenshot and Inspect

```bash
browse-agent launch
browse-agent navigate "https://example.com"

# Take a screenshot to see the page visually
browse-agent screenshot visible

# Run JS to count elements, check state, etc.
browse-agent evaluate "document.querySelectorAll('a').length"

browse-agent close
```

### Multi-Page Exploration

```bash
browse-agent launch

# Visit first page
browse-agent navigate "https://example.com"
browse-agent get-content --format text

# Visit second page (based on what you found)
browse-agent navigate "https://example.org"
browse-agent get-content --format text

# Manage tabs
browse-agent tabs list
browse-agent tabs close 123

browse-agent close
```

### Use Logged-in Browser Profile

```bash
# Launch with user's default browser profile (preserves cookies/sessions)
browse-agent launch --browser chrome
# ⚠ Close all Chrome windows first!

USE_USER_PROFILE=true browse-agent launch
browse-agent navigate "https://github.com/notifications"
browse-agent get-content --format text
browse-agent close
```

## One-Shot Script Examples

### Extract Text from a Page

```javascript
import { browse } from 'browse-agent-cli/script';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://example.com');
  const result = await agent.getContent({ format: 'text', tabId });
  return { title: result.title, text: result.content };
});
```

### Query DOM Elements

```javascript
import { browse } from 'browse-agent-cli/script';

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
import { browse } from 'browse-agent-cli/script';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://example.com');
  const count = await agent.evaluate('document.querySelectorAll("a").length', tabId);
  return { linkCount: count.result };
});
```

### Take a Screenshot

```javascript
import { browse } from 'browse-agent-cli/script';
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
import { browse } from 'browse-agent-cli/script';

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
import { browse } from 'browse-agent-cli/script';

await browse(async (agent) => {
  const { tabId } = await agent.navigate('https://github.com/notifications');
  const content = await agent.getContent({ format: 'text', tabId });
  return { title: content.title, content: content.content };
}, { useUserProfile: true });
```

### Override Browser Options via Env

```bash
# Use user's default Chrome profile (keeps login sessions)
USE_USER_PROFILE=true node _browse_task.mjs

# Use Edge with user profile
BROWSER=edge USE_USER_PROFILE=true node _browse_task.mjs

# Custom executable path
CHROME_PATH=/path/to/browser node _browse_task.mjs
```

### Options via Code

```javascript
// Use Edge with user profile
await browse(async (agent) => { /* ... */ }, {
  browser: 'edge',
  useUserProfile: true,
});

// Return result without printing JSON to stdout
const data = await browse(async (agent) => {
  await agent.navigate('https://example.com');
  return { title: 'ok' };
}, {
  printResult: false,
});
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
