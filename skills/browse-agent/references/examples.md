# Examples & Troubleshooting

## Step-by-Step CLI Examples (Recommended)

### Extract Text from a Page

```bash
# 1. Launch browser
node skills/browse-agent/cli.mjs launch 2>/dev/null

# 2. Navigate to page
node skills/browse-agent/cli.mjs navigate "https://example.com" 2>/dev/null

# 3. Read content — decide next step based on output
node skills/browse-agent/cli.mjs get-content --format text 2>/dev/null

# 4. Done — close browser
node skills/browse-agent/cli.mjs close 2>/dev/null
```

### Find Specific Content on a Page

```bash
node skills/browse-agent/cli.mjs launch 2>/dev/null
node skills/browse-agent/cli.mjs navigate "https://news.ycombinator.com" 2>/dev/null

# First, read the page to understand structure
node skills/browse-agent/cli.mjs get-content --format text 2>/dev/null

# Then query specific elements based on what you found
node skills/browse-agent/cli.mjs get-dom ".titleline > a" --property innerText --all 2>/dev/null

node skills/browse-agent/cli.mjs close 2>/dev/null
```

### Screenshot and Inspect

```bash
node skills/browse-agent/cli.mjs launch 2>/dev/null
node skills/browse-agent/cli.mjs navigate "https://example.com" 2>/dev/null

# Take a screenshot to see the page visually
node skills/browse-agent/cli.mjs screenshot visible 2>/dev/null

# Run JS to count elements, check state, etc.
node skills/browse-agent/cli.mjs evaluate "document.querySelectorAll('a').length" 2>/dev/null

node skills/browse-agent/cli.mjs close 2>/dev/null
```

### Multi-Page Exploration

```bash
node skills/browse-agent/cli.mjs launch 2>/dev/null

# Visit first page
node skills/browse-agent/cli.mjs navigate "https://example.com" 2>/dev/null
node skills/browse-agent/cli.mjs get-content --format text 2>/dev/null

# Visit second page (based on what you found)
node skills/browse-agent/cli.mjs navigate "https://example.org" 2>/dev/null
node skills/browse-agent/cli.mjs get-content --format text 2>/dev/null

# Manage tabs
node skills/browse-agent/cli.mjs tabs list 2>/dev/null
node skills/browse-agent/cli.mjs tabs close 123 2>/dev/null

node skills/browse-agent/cli.mjs close 2>/dev/null
```

### Use Logged-in Browser Profile

```bash
# Launch with user's default browser profile (preserves cookies/sessions)
node skills/browse-agent/cli.mjs launch --browser chrome 2>/dev/null
# ⚠ Close all Chrome windows first!

USE_USER_PROFILE=true node skills/browse-agent/cli.mjs launch 2>/dev/null
node skills/browse-agent/cli.mjs navigate "https://github.com/notifications" 2>/dev/null
node skills/browse-agent/cli.mjs get-content --format text 2>/dev/null
node skills/browse-agent/cli.mjs close 2>/dev/null
```

## One-Shot Script Examples

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

### Override Browser Options via Env

```bash
# Use user's default Chrome profile (keeps login sessions)
USE_USER_PROFILE=true node _browse_task.mjs 2>/dev/null

# Use Edge with user profile
BROWSER=edge USE_USER_PROFILE=true node _browse_task.mjs 2>/dev/null

# Custom executable path
CHROME_PATH=/path/to/browser node _browse_task.mjs 2>/dev/null
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
