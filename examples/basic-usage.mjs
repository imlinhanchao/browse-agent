/**
 * Example: Using browse-agent-sdk to control Chrome
 *
 * Prerequisites:
 * 1. Build the project: npm run build
 * 2. Load the extension from packages/extension/build/ in Chrome
 * 3. Open extension popup, set the secret to match this script
 * 4. Run this script: node --experimental-vm-modules examples/basic-usage.mjs
 */

import { BrowserAgent } from '../packages/sdk/dist/index.js';

const SECRET = 'my-secure-secret-change-me';

async function main() {
  // Create a browser agent
  const agent = new BrowserAgent({
    secret: SECRET,
    port: 9315,
  });

  // Start the WebSocket server
  await agent.start();
  console.log('Waiting for Chrome extension to connect...');
  console.log('Make sure the extension is loaded and configured with the same secret.');

  // Wait for the extension to connect
  await agent.waitForConnection(120000);
  console.log('Extension connected!\n');

  // 1. Navigate to a page
  console.log('--- Navigate ---');
  const nav = await agent.navigate('https://example.com');
  console.log(`Opened: ${nav.title} (${nav.url}), tabId: ${nav.tabId}\n`);

  // 2. Get page content
  console.log('--- Get Content ---');
  const content = await agent.getContent({ tabId: nav.tabId, format: 'text' });
  console.log(`Page text (first 200 chars): ${content.content.slice(0, 200)}\n`);

  // 3. Inject CSS
  console.log('--- Inject CSS ---');
  await agent.injectCSS('body { background: #f0f8ff !important; }', nav.tabId);
  console.log('Injected blue background CSS\n');

  // 4. Evaluate JavaScript
  console.log('--- Evaluate JS ---');
  const evalResult = await agent.evaluate('document.title', nav.tabId);
  console.log(`document.title = ${evalResult.result}\n`);

  // 5. Query DOM
  console.log('--- Get DOM ---');
  const dom = await agent.getDOM('h1', { tabId: nav.tabId, property: 'innerText' });
  console.log(`h1 elements: ${JSON.stringify(dom.elements)}\n`);

  // 6. Screenshot (visible viewport)
  console.log('--- Screenshot (visible) ---');
  const screenshot = await agent.screenshotVisible({ tabId: nav.tabId });
  console.log(`Screenshot captured: ${screenshot.format}, ${screenshot.data.length} bytes base64\n`);

  // 7. Full page screenshot
  console.log('--- Screenshot (full page) ---');
  const fullScreenshot = await agent.screenshotFullPage({ tabId: nav.tabId });
  console.log(`Full page: ${fullScreenshot.format}, ${fullScreenshot.width}x${fullScreenshot.height}\n`);

  // 8. List tabs
  console.log('--- List Tabs ---');
  const tabs = await agent.listTabs();
  for (const tab of tabs.tabs) {
    console.log(`  [${tab.id}] ${tab.title} - ${tab.url}`);
  }

  // Clean up
  await agent.closeTab(nav.tabId);
  await agent.stop();
  console.log('\nDone!');
}

main().catch(console.error);
