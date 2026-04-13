import { execSync, spawn } from 'node:child_process';
import { findBrowser, getProfileDir, importSdk, resolveOptions, saveSession, type SessionData } from './config';

const BROWSE_AGENT_WEBSTORE_URL =
  'https://chromewebstore.google.com/detail/browse-agent/amfbnjpgfgappenkkklkogngmoeofeae?authuser=0&hl=zh-CN';

interface LaunchOptions {
  browser?: 'chrome' | 'chromium' | 'edge' | 'brave';
  headless?: boolean;
  useUserProfile?: boolean;
  port?: number;
  timeout?: number;
  secret?: string;
}

export async function launchBrowser(options: LaunchOptions = {}): Promise<SessionData> {
  const { BrowserAgent } = await importSdk();
  const opts = resolveOptions(options);
  const profileDir = getProfileDir(opts.browser, opts.useUserProfile ?? true);

  // Kill existing browser processes using the same profile to allow --load-extension to work.
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM chrome.exe /IM msedge.exe /IM brave.exe 2>nul', { stdio: 'ignore' });
    } else {
      if (opts.useUserProfile) {
        const processMap: Record<string, string[]> = {
          chrome: ['Google Chrome'],
          chromium: ['Chromium'],
          edge: ['Microsoft Edge'],
          brave: ['Brave Browser'],
        };
        for (const processName of processMap[opts.browser] || []) {
          execSync(`pkill -x "${processName}" 2>/dev/null || true`, { stdio: 'pipe', shell: '/bin/sh' } as object);
        }
      } else {
        execSync(`pkill -f "user-data-dir=${profileDir}" 2>/dev/null || true`, { stdio: 'pipe', shell: '/bin/sh' } as object);
      }
    }
  } catch {
    // Ignore errors — no process to kill is fine.
  }

  const agent = new BrowserAgent({ secret: opts.secret, port: opts.port });
  await agent.start();
  console.error(`[browse-agent] Server started on port ${opts.port}`);

  const launchArgs = [
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    BROWSE_AGENT_WEBSTORE_URL,
  ];

  if (opts.headless) launchArgs.push('--headless=new');

  const browserExe = findBrowser(opts.browser);
  const proc = spawn(browserExe, launchArgs, { stdio: 'ignore', detached: true });

  proc.on('error', (err) => {
    console.error(`[browse-agent] ${opts.browser} launch failed:`, err.message);
    process.exit(1);
  });

  proc.unref();

  const session: SessionData = {
    pid: proc.pid,
    port: opts.port,
    secret: opts.secret,
    browser: opts.browser,
    profileDir,
    extensionWork: 'chrome-webstore:amfbnjpgfgappenkkklkogngmoeofeae',
    startedAt: new Date().toISOString(),
    _agent: agent,
    _proc: proc,
  };

  saveSession(session);
  console.error(`[browse-agent] Browser launched (PID: ${proc.pid})`);
  console.error('[browse-agent] Opened Chrome Web Store page. Please click "Add to Chrome" if not installed.');

  return session;
}
