import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PROFILE_PATHS, findBrowser, resolveOptions } from './config';

const BROWSE_AGENT_WEBSTORE_URL =
  'https://chromewebstore.google.com/detail/browse-agent/amfbnjpgfgappenkkklkogngmoeofeae?authuser=0&hl=zh-CN';
const BROWSE_AGENT_EXTENSION_ID = 'amfbnjpgfgappenkkklkogngmoeofeae';
const INSTALL_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const INSTALL_POLL_INTERVAL_MS = 1500;

function openUrlInSelectedBrowser(url: string): void {
  const opts = resolveOptions();
  const browserExe = findBrowser(opts.browser);
  const proc = spawn(browserExe, ['--new-window', url], {
    stdio: 'ignore',
    detached: true,
  });

  proc.on('error', (err) => {
    throw new Error(`${opts.browser} launch failed: ${err.message}`);
  });

  proc.unref();
}

function listProfileDirs(userDataDir: string): string[] {
  const candidates = ['Default'];
  try {
    for (const name of readdirSync(userDataDir)) {
      if (name.startsWith('Profile ')) candidates.push(name);
    }
  } catch {
    // Ignore and fall back to Default only.
  }
  return [...new Set(candidates)].map((name) => join(userDataDir, name));
}

function isExtensionInstalledInBrowser(browser: 'chrome' | 'chromium' | 'edge' | 'brave'): boolean {
  const userDataDir = DEFAULT_PROFILE_PATHS[browser]?.[process.platform];
  if (!userDataDir || !existsSync(userDataDir)) return false;

  for (const profileDir of listProfileDirs(userDataDir)) {
    const extDir = join(profileDir, 'Extensions', BROWSE_AGENT_EXTENSION_ID);
    if (!existsSync(extDir)) continue;

    try {
      const versions = readdirSync(extDir);
      if (versions.length > 0) return true;
    } catch {
      // Continue scanning other profiles.
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExtensionInstall(
  browser: 'chrome' | 'chromium' | 'edge' | 'brave',
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isExtensionInstalledInBrowser(browser)) return true;
    await sleep(INSTALL_POLL_INTERVAL_MS);
  }

  return false;
}

export async function setup(): Promise<void> {
  const browser = resolveOptions().browser;
  const installed = isExtensionInstalledInBrowser(browser);

  if (installed) {
    console.log(`Browse Agent extension is already installed in ${browser}.`);
    return;
  }

  console.log(`Opening Chrome Web Store install page in ${browser}...`);

  try {
    openUrlInSelectedBrowser(BROWSE_AGENT_WEBSTORE_URL);
    console.log('Please click "Add to Chrome" to install Browse Agent.');
    console.log('Browser extensions cannot be silently installed from CLI without enterprise policy.');
    console.log(`If it did not open automatically, visit:\n${BROWSE_AGENT_WEBSTORE_URL}\n`);

    console.log('Waiting for extension installation...');
    const installedAfterOpen = await waitForExtensionInstall(browser, INSTALL_WAIT_TIMEOUT_MS);
    if (installedAfterOpen) {
      console.log(`Browse Agent extension installation detected in ${browser}.`);
      return;
    }

    console.error(
      `Timed out after ${Math.round(INSTALL_WAIT_TIMEOUT_MS / 1000)}s waiting for extension install in ${browser}.`,
    );
    console.error('Please finish installation in browser, then run "browse-agent setup" again.');
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to open browser automatically: ${msg}`);
    console.error(`Please open manually:\n${BROWSE_AGENT_WEBSTORE_URL}\n`);
    process.exit(1);
  }
}
