/**
 * Shared configuration and utilities for browse-agent scripts.
 *
 * Environment variables:
 *   BROWSER            - chrome | chromium | edge | brave (default: chrome)
 *   HEADLESS           - true | false (default: false)
 *   USE_USER_PROFILE   - true | false (default: false)
 *   CHROME_PATH        - Custom browser executable path
 *   BROWSE_AGENT_PORT  - WebSocket port (default: 9315)
 *   CONNECTION_TIMEOUT - Wait for extension connection in ms (default: 30000)
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';

// ── Browser executable paths ──────────────────────────────────────────────────

export const BROWSER_PATHS = {
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

export const DEFAULT_PROFILE_PATHS = {
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

// ── State file for cross-script communication ─────────────────────────────────

const BASE_DIR = join(process.cwd(), '.browse-agent');
const STATE_FILE = join(BASE_DIR, '_session.json');

export function saveSession(data) {
  mkdirSync(BASE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

export function loadSession() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

export function clearSession() {
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function findBrowser(browser) {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const paths = BROWSER_PATHS[browser];
  if (!paths) throw new Error(`Unknown browser: ${browser}. Use: chrome, chromium, edge, brave`);
  const isAbsolute = (p) => p.startsWith('/') || /^[a-zA-Z]:\\/.test(p);
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  for (const p of paths[process.platform] || []) {
    try {
      if (isAbsolute(p)) {
        if (existsSync(p)) return p;
      } else {
        const resolved = execSync(`${whichCmd} "${p}"`, { stdio: 'pipe' }).toString().trim().split('\n')[0];
        if (resolved) return resolved;
      }
    } catch {}
  }
  if (browser !== 'edge') {
    console.error(`[browse-agent] ${browser} not found, falling back to edge...`);
    return findBrowser('edge');
  }
  throw new Error(`No supported browser found. Set CHROME_PATH env variable or install Chrome/Edge.`);
}

export function getProfileDir(browser, useUserProfile) {
  if (useUserProfile) {
    const profilePath = DEFAULT_PROFILE_PATHS[browser]?.[process.platform];
    if (profilePath && existsSync(profilePath)) return profilePath;
    console.error(`[browse-agent] Default ${browser} profile not found at ${profilePath}`);
    console.error('[browse-agent] Falling back to isolated profile.');
  }
  const dir = join(BASE_DIR, 'chrome-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function patchExtension(port, secret) {
  const extensionSrc = join(BASE_DIR, 'extension');
  const extensionWork = join(BASE_DIR, '_ext_work');

  if (existsSync(extensionWork)) rmSync(extensionWork, { recursive: true });
  cpSync(extensionSrc, extensionWork, { recursive: true });

  const swPath = join(extensionWork, 'service-worker.js');
  const originalSW = readFileSync(swPath, 'utf8');
  writeFileSync(swPath, [
    `chrome.storage.local.set({ wsUrl: 'ws://127.0.0.1:${port}', secret: '${secret}' });`,
    originalSW,
  ].join('\n'));

  return extensionWork;
}

export function cleanExtensionWork() {
  const extensionWork = join(BASE_DIR, '_ext_work');
  if (existsSync(extensionWork)) rmSync(extensionWork, { recursive: true });
}

export function resolveOptions(options = {}) {
  return {
    browser:        options.browser        ?? process.env.BROWSER            ?? 'chrome',
    headless:       options.headless       ?? process.env.HEADLESS === 'true',
    useUserProfile: options.useUserProfile ?? process.env.USE_USER_PROFILE === 'true',
    port:           options.port           ?? Number(process.env.BROWSE_AGENT_PORT || 9315),
    timeout:        options.timeout        ?? Number(process.env.CONNECTION_TIMEOUT || 30000),
    secret:         options.secret         ?? process.env.SHARED_SECRET      ?? '',
  };
}
