import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type BrowserName = 'chrome' | 'chromium' | 'edge' | 'brave';

interface ResolveOptionsInput {
  browser?: BrowserName;
  headless?: boolean;
  useUserProfile?: boolean;
  port?: number;
  timeout?: number;
  secret?: string;
}

interface ResolveOptionsOutput {
  browser: BrowserName;
  headless: boolean;
  useUserProfile: boolean;
  port: number;
  timeout: number;
  secret: string;
}

const CLI_RUNTIME_DIR = dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const DEFAULT_BASE_DIR = HOME ? join(HOME, '.browse-agent') : join(process.cwd(), '.browse-agent');

function unique(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

export const BROWSER_PATHS: Record<BrowserName, Record<NodeJS.Platform, string[]>> = {
  chrome: {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['google-chrome', 'google-chrome-stable'],
    win32: [
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    aix: [],
    android: [],
    freebsd: [],
    haiku: [],
    openbsd: [],
    sunos: [],
    cygwin: [],
    netbsd: [],
  },
  chromium: {
    darwin: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['chromium-browser', 'chromium'],
    win32: [`${process.env.LOCALAPPDATA}\\Chromium\\Application\\chrome.exe`],
    aix: [],
    android: [],
    freebsd: [],
    haiku: [],
    openbsd: [],
    sunos: [],
    cygwin: [],
    netbsd: [],
  },
  edge: {
    darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['microsoft-edge', 'microsoft-edge-stable'],
    win32: [
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    aix: [],
    android: [],
    freebsd: [],
    haiku: [],
    openbsd: [],
    sunos: [],
    cygwin: [],
    netbsd: [],
  },
  brave: {
    darwin: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    linux: ['brave-browser', 'brave'],
    win32: [
      `${process.env.PROGRAMFILES}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    ],
    aix: [],
    android: [],
    freebsd: [],
    haiku: [],
    openbsd: [],
    sunos: [],
    cygwin: [],
    netbsd: [],
  },
};

export const BASE_DIR = process.env.BROWSE_AGENT_HOME || DEFAULT_BASE_DIR;
export const DEFAULT_SERVICE_PORT = Number(process.env.BROWSE_AGENT_SERVICE_PORT || 9316);
export const LEGACY_BASE_DIRS = unique([
  join(CLI_RUNTIME_DIR, '.browse-agent'),
  join(dirname(CLI_RUNTIME_DIR), '.browse-agent'),
  join(process.cwd(), '.browse-agent'),
]).filter((dir) => dir !== BASE_DIR);

export async function importSdk(): Promise<typeof import('browse-agent-sdk')> {
  try {
    return await import('browse-agent-sdk');
  } catch {
    // Fallback to node_modules near runtime cli.js.
  }

  const globalSdk = join(dirname(CLI_RUNTIME_DIR), 'node_modules', 'browse-agent-sdk');
  if (existsSync(globalSdk)) {
    const pkg = JSON.parse(readFileSync(join(globalSdk, 'package.json'), 'utf8')) as {
      module?: string;
      main?: string;
    };
    const entry = pkg.module || pkg.main || 'index.js';
    return await import(pathToFileURL(join(globalSdk, entry)).href);
  }

  throw new Error('browse-agent-sdk not found. Run "setup" first.');
}

export const DEFAULT_PROFILE_PATHS: Record<BrowserName, Record<NodeJS.Platform, string>> = {
  chrome: {
    darwin: join(HOME, 'Library', 'Application Support', 'Google', 'Chrome'),
    linux: join(HOME, '.config', 'google-chrome'),
    win32: join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    aix: '',
    android: '',
    freebsd: '',
    haiku: '',
    openbsd: '',
    sunos: '',
    cygwin: '',
    netbsd: '',
  },
  chromium: {
    darwin: join(HOME, 'Library', 'Application Support', 'Chromium'),
    linux: join(HOME, '.config', 'chromium'),
    win32: join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data'),
    aix: '',
    android: '',
    freebsd: '',
    haiku: '',
    openbsd: '',
    sunos: '',
    cygwin: '',
    netbsd: '',
  },
  edge: {
    darwin: join(HOME, 'Library', 'Application Support', 'Microsoft Edge'),
    linux: join(HOME, '.config', 'microsoft-edge'),
    win32: join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
    aix: '',
    android: '',
    freebsd: '',
    haiku: '',
    openbsd: '',
    sunos: '',
    cygwin: '',
    netbsd: '',
  },
  brave: {
    darwin: join(HOME, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'),
    linux: join(HOME, '.config', 'BraveSoftware', 'Brave-Browser'),
    win32: join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data'),
    aix: '',
    android: '',
    freebsd: '',
    haiku: '',
    openbsd: '',
    sunos: '',
    cygwin: '',
    netbsd: '',
  },
};

export interface SessionData {
  pid?: number;
  port: number;
  secret: string;
  browser: BrowserName;
  profileDir: string;
  extensionWork: string;
  startedAt: string;
  _agent?: any;
  _proc?: any;
}

export interface ServiceSessionData {
  pid: number;
  servicePort: number;
  startedAt: string;
}

export function saveSession(data: SessionData): void {
  mkdirSync(BASE_DIR, { recursive: true });
  writeFileSync(join(BASE_DIR, '_session.json'), JSON.stringify(data, null, 2));
}

export function loadSession(): SessionData | null {
  const stateFile = join(BASE_DIR, '_session.json');
  if (!existsSync(stateFile)) return null;
  return JSON.parse(readFileSync(stateFile, 'utf8')) as SessionData;
}

export function clearSession(): void {
  const stateFile = join(BASE_DIR, '_session.json');
  if (existsSync(stateFile)) rmSync(stateFile);
}

export function saveServiceSession(data: ServiceSessionData): void {
  mkdirSync(BASE_DIR, { recursive: true });
  writeFileSync(join(BASE_DIR, '_service.json'), JSON.stringify(data, null, 2));
}

export function loadServiceSession(): ServiceSessionData | null {
  const stateFile = join(BASE_DIR, '_service.json');
  if (!existsSync(stateFile)) return null;
  return JSON.parse(readFileSync(stateFile, 'utf8')) as ServiceSessionData;
}

export function clearServiceSession(): void {
  const stateFile = join(BASE_DIR, '_service.json');
  if (existsSync(stateFile)) rmSync(stateFile);
}

export function findBrowser(browser: BrowserName): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const paths = BROWSER_PATHS[browser];
  if (!paths) throw new Error(`Unknown browser: ${browser}. Use: chrome, chromium, edge, brave`);

  const isAbsolute = (path: string): boolean => path.startsWith('/') || /^[a-zA-Z]:\\/.test(path);
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';

  for (const path of paths[process.platform] || []) {
    try {
      if (isAbsolute(path)) {
        if (existsSync(path)) return path;
      } else {
        const resolved = execSync(`${whichCmd} "${path}"`, { stdio: 'pipe' })
          .toString()
          .trim()
          .split('\n')[0];
        if (resolved) return resolved;
      }
    } catch {
      // Try next candidate.
    }
  }

  if (browser !== 'edge') {
    console.error(`[browse-agent] ${browser} not found, falling back to edge...`);
    return findBrowser('edge');
  }

  throw new Error('No supported browser found. Set CHROME_PATH env variable or install Chrome/Edge.');
}

export function getProfileDir(browser: BrowserName, useUserProfile: boolean): string {
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

export function patchExtension(port: number, secret: string): string {
  const legacyWithExtension = LEGACY_BASE_DIRS.find((dir) =>
    existsSync(join(dir, 'extension', 'manifest.json')),
  );
  const extensionSrc = legacyWithExtension
    ? join(legacyWithExtension, 'extension')
    : join(BASE_DIR, 'extension');
  const extensionWork = join(BASE_DIR, '_ext_work');

  if (!existsSync(join(extensionSrc, 'manifest.json'))) {
    throw new Error(
      `Extension is not installed at ${extensionSrc}. Run "browse-agent setup" first.`,
    );
  }

  if (existsSync(extensionWork)) rmSync(extensionWork, { recursive: true });
  cpSync(extensionSrc, extensionWork, { recursive: true });

  const swPath = join(extensionWork, 'service-worker.js');
  const originalSW = readFileSync(swPath, 'utf8');
  writeFileSync(
    swPath,
    [
      `chrome.storage.local.set({ wsUrl: 'ws://127.0.0.1:${port}', secret: '${secret}' });`,
      originalSW,
    ].join('\n'),
  );

  return extensionWork;
}

export function cleanExtensionWork(): void {
  const extensionWork = join(BASE_DIR, '_ext_work');
  if (existsSync(extensionWork)) rmSync(extensionWork, { recursive: true });
}

export function resolveOptions(options: ResolveOptionsInput = {}): ResolveOptionsOutput {
  return {
    browser: options.browser ?? (process.env.BROWSER as BrowserName | undefined) ?? 'chrome',
    headless: options.headless ?? process.env.HEADLESS === 'true',
    useUserProfile: options.useUserProfile ?? process.env.USE_USER_PROFILE !== 'false',
    port: options.port ?? Number(process.env.BROWSE_AGENT_PORT || 9315),
    timeout: options.timeout ?? Number(process.env.CONNECTION_TIMEOUT || 30000),
    secret: options.secret ?? process.env.SHARED_SECRET ?? '',
  };
}
