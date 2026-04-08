/**
 * Shared configuration and utilities for browse-agent scripts.
 *
 * Environment variables:
 *   BROWSER              - chrome | chromium | edge | brave (default: chrome)
 *   HEADLESS             - true | false (default: false)
 *   USE_USER_PROFILE     - true | false (default: false)
 *   CHROME_PATH          - Custom browser executable path
 *   BROWSE_AGENT_PORT    - WebSocket port (default: 9315)
 *   CONNECTION_TIMEOUT   - Wait for extension connection in ms (default: 30000)
 *   BROWSE_AGENT_GLOBAL  - true to use global installation (~/.browse-agent)
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

// ── Skill directory detection ─────────────────────────────────────────────────

const SKILL_DIR = join(fileURLToPath(import.meta.url), '..', '..');

/**
 * Check whether the skill directory is inside process.cwd() (or its subdirectories).
 * Used to determine default setup mode: local if skill is in cwd, global otherwise.
 */
export function isSkillInCwd() {
  const cwd = join(process.cwd());
  const resolved = join(SKILL_DIR);
  return resolved.startsWith(cwd + '/') || resolved === cwd;
}

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

// ── Base directory resolution ─────────────────────────────────────────────────

export const GLOBAL_BASE_DIR = join(HOME, '.browse-agent');
export const LOCAL_BASE_DIR = join(process.cwd(), '.browse-agent');

export function isGlobalMode() {
  if (process.env.BROWSE_AGENT_GLOBAL === 'true') return true;
  if (existsSync(join(LOCAL_BASE_DIR, 'extension', 'manifest.json'))) return false;
  if (existsSync(join(GLOBAL_BASE_DIR, 'extension', 'manifest.json'))) return true;
  return false;
}

export function getBaseDir(global) {
  if (global !== undefined) return global ? GLOBAL_BASE_DIR : LOCAL_BASE_DIR;
  return isGlobalMode() ? GLOBAL_BASE_DIR : LOCAL_BASE_DIR;
}

// ── SDK resolution ────────────────────────────────────────────────────────────

export function isSdkInstalled(global) {
  if (global) {
    return existsSync(join(GLOBAL_BASE_DIR, 'node_modules', 'browse-agent-sdk'));
  }
  return existsSync(join(process.cwd(), 'node_modules', 'browse-agent-sdk'));
}

export async function importSdk() {
  try {
    return await import('browse-agent-sdk');
  } catch {}
  const globalSdk = join(GLOBAL_BASE_DIR, 'node_modules', 'browse-agent-sdk');
  if (existsSync(globalSdk)) {
    const pkg = JSON.parse(readFileSync(join(globalSdk, 'package.json'), 'utf8'));
    const entry = pkg.module || pkg.main || 'index.js';
    return await import(pathToFileURL(join(globalSdk, entry)).href);
  }
  throw new Error('browse-agent-sdk not found. Run "setup" first.');
}

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

export function saveSession(data) {
  const baseDir = getBaseDir();
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(join(baseDir, '_session.json'), JSON.stringify(data, null, 2));
}

export function loadSession() {
  const stateFile = join(getBaseDir(), '_session.json');
  if (!existsSync(stateFile)) return null;
  return JSON.parse(readFileSync(stateFile, 'utf8'));
}

export function clearSession() {
  const stateFile = join(getBaseDir(), '_session.json');
  if (existsSync(stateFile)) rmSync(stateFile);
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
  const dir = join(getBaseDir(), 'chrome-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function patchExtension(port, secret) {
  const baseDir = getBaseDir();
  const extensionSrc = join(baseDir, 'extension');
  const extensionWork = join(baseDir, '_ext_work');

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
  const extensionWork = join(getBaseDir(), '_ext_work');
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
