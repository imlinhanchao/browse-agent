import { spawn } from 'node:child_process';
import { findBrowser, getProfileDir, importSdk, patchExtension, resolveOptions, saveSession, type SessionData } from './config';

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
  const extensionWork = patchExtension(opts.port, opts.secret);
  const profileDir = getProfileDir(opts.browser, opts.useUserProfile ?? true);

  const agent = new BrowserAgent({ secret: opts.secret, port: opts.port });
  await agent.start();
  console.error(`[browse-agent] Server started on port ${opts.port}`);

  const launchArgs = [
    `--load-extension=${extensionWork}`,
    '--no-first-run',
    '--no-default-browser-check',
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
    extensionWork,
    startedAt: new Date().toISOString(),
    _agent: agent,
    _proc: proc,
  };

  saveSession(session);
  console.error(`[browse-agent] Browser launched (PID: ${proc.pid})`);

  return session;
}
