/**
 * Launch a browser with the browse-agent extension loaded.
 * Saves session state (pid, port, secret) for other scripts to use.
 *
 * Usage:
 *   import { launchBrowser } from './launch-browser.mjs';
 *   const session = await launchBrowser();        // uses env/defaults
 *   const session = await launchBrowser({ browser: 'edge', useUserProfile: true });
 *
 * CLI:
 *   node launch-browser.mjs                       # uses defaults
 *   BROWSER=edge USE_USER_PROFILE=true node launch-browser.mjs
 */
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { BrowserAgent } from 'browse-agent-sdk';
import {
  findBrowser, getProfileDir, patchExtension,
  resolveOptions, saveSession,
} from './config.mjs';

export async function launchBrowser(options = {}) {
  const opts = resolveOptions(options);
  const extensionWork = patchExtension(opts.port, opts.secret);
  const profileDir = getProfileDir(opts.browser, opts.useUserProfile);

  const agent = new BrowserAgent({ secret: opts.secret, port: opts.port });
  await agent.start();
  console.error(`[browse-agent] Server started on port ${opts.port}`);

  const launchArgs = [
    `--load-extension=${extensionWork}`,
    `--user-data-dir=${profileDir}`,
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

  const session = {
    pid: proc.pid,
    port: opts.port,
    secret: opts.secret,
    browser: opts.browser,
    profileDir,
    extensionWork,
    startedAt: new Date().toISOString(),
  };
  saveSession(session);
  console.error(`[browse-agent] Browser launched (PID: ${proc.pid})`);

  // Keep agent reference for connection step
  session._agent = agent;
  session._proc = proc;
  return session;
}

// CLI entry point
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const session = await launchBrowser();
  // Print session info (without internal refs) to stdout
  const { _agent, _proc, ...info } = session;
  console.log(JSON.stringify(info, null, 2));
  // Keep process alive briefly for the browser to start, then exit
  // Connection will be handled by connect.mjs
  await _agent.stop();
}
