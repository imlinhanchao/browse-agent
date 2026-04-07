/**
 * browse-agent launcher — reusable browser lifecycle manager.
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
import { BrowserAgent } from 'browse-agent-sdk';
import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';

// ── Browser executable paths ──────────────────────────────────────────────────

const BROWSER_PATHS = {
  chrome: {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['google-chrome', 'google-chrome-stable'],
    win32: [
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
  },
  chromium: {
    darwin: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['chromium-browser', 'chromium'],
    win32: [`${process.env.LOCALAPPDATA}\\Chromium\\Application\\chrome.exe`],
  },
  edge: {
    darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['microsoft-edge', 'microsoft-edge-stable'],
    win32: [
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
  },
  brave: {
    darwin: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    linux: ['brave-browser', 'brave'],
    win32: [
      `${process.env.PROGRAMFILES}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    ],
  },
};

// ── Default user profile paths ────────────────────────────────────────────────

const HOME = process.env.HOME || process.env.USERPROFILE;

const DEFAULT_PROFILE_PATHS = {
  chrome: {
    darwin: join(HOME, 'Library', 'Application Support', 'Google', 'Chrome'),
    linux: join(HOME, '.config', 'google-chrome'),
    win32: join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
  },
  chromium: {
    darwin: join(HOME, 'Library', 'Application Support', 'Chromium'),
    linux: join(HOME, '.config', 'chromium'),
    win32: join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data'),
  },
  edge: {
    darwin: join(HOME, 'Library', 'Application Support', 'Microsoft Edge'),
    linux: join(HOME, '.config', 'microsoft-edge'),
    win32: join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
  },
  brave: {
    darwin: join(HOME, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'),
    linux: join(HOME, '.config', 'BraveSoftware', 'Brave-Browser'),
    win32: join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data'),
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function findBrowser(browser) {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const paths = BROWSER_PATHS[browser];
  if (!paths) throw new Error(`Unknown browser: ${browser}. Use: chrome, chromium, edge, brave`);
  for (const p of paths[process.platform] || []) {
    try {
      if (process.platform === 'linux') {
        execSync(`which "${p}"`, { stdio: 'ignore' });
        return p;
      }
      if (existsSync(p)) return p;
    } catch {}
  }
  throw new Error(`${browser} not found. Set CHROME_PATH env variable or install ${browser}.`);
}

function getProfileDir(browser, useUserProfile) {
  if (useUserProfile) {
    const profilePath = DEFAULT_PROFILE_PATHS[browser]?.[process.platform];
    if (profilePath && existsSync(profilePath)) return profilePath;
    console.error(`[browse-agent] Default ${browser} profile not found at ${profilePath}`);
    console.error('[browse-agent] Falling back to isolated profile.');
  }
  const dir = join(process.cwd(), '.browse-agent', 'chrome-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function patchExtension(extensionSrc, extensionWork, port, secret) {
  if (existsSync(extensionWork)) rmSync(extensionWork, { recursive: true });
  cpSync(extensionSrc, extensionWork, { recursive: true });

  const swPath = join(extensionWork, 'service-worker.js');
  const originalSW = readFileSync(swPath, 'utf8');
  writeFileSync(swPath, [
    `chrome.storage.local.set({ wsUrl: 'ws://127.0.0.1:${port}', secret: '${secret}' });`,
    originalSW,
  ].join('\n'));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Launch a browser, connect the browse-agent extension, run a task, then clean up.
 *
 * @param {(agent: BrowserAgent) => Promise<any>} task
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
  const browser   = options.browser         ?? process.env.BROWSER           ?? 'chrome';
  const headless  = options.headless        ?? process.env.HEADLESS === 'true';
  const useUser   = options.useUserProfile  ?? process.env.USE_USER_PROFILE === 'true';
  const port      = options.port            ?? Number(process.env.BROWSE_AGENT_PORT || 9315);
  const timeout   = options.timeout         ?? Number(process.env.CONNECTION_TIMEOUT || 30000);
  const secret    = options.secret          ?? process.env.SHARED_SECRET     ?? '';

  const extensionSrc  = join(process.cwd(), '.browse-agent', 'extension');
  const extensionWork = join(process.cwd(), '.browse-agent', '_ext_work');
  const profileDir    = getProfileDir(browser, useUser);

  patchExtension(extensionSrc, extensionWork, port, secret);

  const agent = new BrowserAgent({ secret, port });
  let proc;
  try {
    await agent.start();
    console.error(`[browse-agent] Server started on port ${port}`);

    const launchArgs = [
      `--load-extension=${extensionWork}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ];
    if (headless) launchArgs.push('--headless=new');

    proc = spawn(findBrowser(browser), launchArgs, { stdio: 'ignore', detached: false });
    proc.on('error', (err) => {
      console.error(`[browse-agent] ${browser} launch failed:`, err.message);
      process.exit(1);
    });

    await agent.waitForConnection(timeout);
    console.error('[browse-agent] Extension connected');

    const result = await task(agent);
    if (result !== undefined) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('[browse-agent] Error:', err.message);
    process.exit(1);
  } finally {
    if (proc) proc.kill();
    await agent.stop();
    if (existsSync(extensionWork)) rmSync(extensionWork, { recursive: true });
  }
}
