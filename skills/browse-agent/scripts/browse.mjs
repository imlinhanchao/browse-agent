/**
 * browse-agent launcher — reusable browser lifecycle manager.
 * Delegates to modular scripts for each step.
 *
 * Usage:
 *   import { browse } from './scripts/browse.mjs';
 *   await browse(async (agent) => {
 *     await agent.navigate('https://example.com');
 *     const content = await agent.getContent({ format: 'text' });
 *     return { title: content.data.title, text: content.data.content };
 *   });
 *
 * Environment variables:
 *   BROWSER            - chrome | chromium | edge | brave (default: chrome)
 *   HEADLESS           - true | false (default: false)
 *   USE_USER_PROFILE   - true | false (default: false)
 *   CHROME_PATH        - Custom browser executable path
 *   BROWSE_AGENT_PORT  - WebSocket port (default: 9315)
 *   CONNECTION_TIMEOUT - Wait for extension connection in ms (default: 30000)
 */
import { resolveOptions, cleanExtensionWork } from './config.mjs';
import { launchBrowser } from './launch-browser.mjs';
import { connect } from './connect.mjs';
import { closeBrowser } from './close-browser.mjs';

// Re-export modular scripts for convenience
export { launchBrowser } from './launch-browser.mjs';
export { connect } from './connect.mjs';
export { closeBrowser } from './close-browser.mjs';
export { navigate } from './navigate.mjs';
export { getContent } from './get-content.mjs';
export { getDOM } from './get-dom.mjs';
export { evaluate } from './evaluate.mjs';
export { injectScript } from './inject-script.mjs';
export { injectCSS } from './inject-css.mjs';
export { screenshot } from './screenshot.mjs';
export { listTabs, closeTab, activateTab } from './tabs.mjs';

/**
 * Launch a browser, connect the browse-agent extension, run a task, then clean up.
 *
 * @param {(agent: import('browse-agent-sdk').BrowserAgent) => Promise<any>} task
 *   Async callback that receives a connected BrowserAgent.
 *   Return a value to have it printed as JSON to stdout.
 *
 * @param {object} [options] Override env-based defaults.
 * @param {string} [options.browser]         - chrome | chromium | edge | brave
 * @param {boolean} [options.headless]       - Run headless
 * @param {boolean} [options.useUserProfile] - Use default browser profile
 * @param {number} [options.port]            - WebSocket port
 * @param {number} [options.timeout]         - Connection timeout (ms)
 * @param {string} [options.secret]          - Optional shared secret
 */
export async function browse(task, options = {}) {
  const opts = resolveOptions(options);
  let session;
  let agent;
  try {
    // 1. Launch browser
    session = await launchBrowser(opts);
    agent = session._agent;

    // 2. Wait for extension connection
    await agent.waitForConnection(opts.timeout);
    console.error('[browse-agent] Extension connected');

    // 3. Run user task
    const result = await task(agent);
    if (result !== undefined) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('[browse-agent] Error:', err.message);
    process.exit(1);
  } finally {
    // 4. Close browser and clean up
    if (session?._proc) {
      try { session._proc.kill(); } catch {}
    }
    if (agent) {
      try { await agent.stop(); } catch {}
    }
    cleanExtensionWork();
  }
}
