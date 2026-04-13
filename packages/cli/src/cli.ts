#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { clear } from './scripts/clear';
import { DEFAULT_SERVICE_PORT, loadServiceSession } from './scripts/config';
import { setup } from './scripts/setup';

type Flags = Record<string, string | boolean | undefined>;

interface ParsedArgs {
  command?: string;
  positional: string[];
  flags: Flags;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args.find((a) => !a.startsWith('-'));
  const positional = args.filter((a) => !a.startsWith('-'));
  const flags: Flags = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--headless') {
      flags.headless = true;
      continue;
    }
    if (arg === '--server-only') {
      flags['server-only'] = true;
      continue;
    }
    if (arg === '--all') {
      flags.all = true;
      continue;
    }
    if (arg.startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('-')) {
      flags[arg.slice(2)] = args[++i];
      continue;
    }
  }

  return { command, positional: positional.slice(1), flags };
}

function getStringFlag(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberFlag(flags: Flags, key: string): number | undefined {
  const value = getStringFlag(flags, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function showHelp(): void {
  console.log(
    `
browse-agent - Browser automation skill CLI

Usage: browse-agent <command> [options]

Lifecycle commands:
  setup                Install Chrome extension
  launch               Start background service and launch browser
  connect              Verify connection to running service/browser
  close                Stop browser and background service
  clear                Remove local installation data
  skill <dir>          Copy skill bundle into <dir>/browse-agent

Feature commands (require launch first):
  navigate <url>       Navigate to URL
  get-content          Get page content (HTML or text)
  get-dom <selector>   Query DOM elements
  evaluate <expr>      Evaluate JavaScript expression
  inject-script <code> Inject and execute JavaScript
  inject-css <code>    Inject CSS stylesheet
  screenshot [mode]    Capture screenshot (visible|fullPage|area)
  tabs [action] [id]   Manage tabs (list|close|activate)

Options:
  --browser <name>       Browser: chrome | chromium | edge | brave (default: chrome)
  --headless             Run in headless mode
  --server-only          Start background service only, skip browser launch
  --port <number>        WebSocket port for browser-agent (default: 9315)
  --servicePort <number> Local service port (default: 9316)
  --tabId <id>           Target tab ID (from navigate or tabs list output)
  --format <type>        Content/screenshot format (text|html / png|jpeg)
  --property <prop>      DOM property: outerHTML | innerHTML | innerText
  --all                  Return all DOM matches instead of first only
  --quality <num>        Screenshot quality (1-100, jpeg only)
  --timeout <ms>         Connection timeout in ms
  --help, -h             Show this help

Examples:
  browse-agent setup
  browse-agent launch --browser edge --headless
  browse-agent launch --server-only
  browse-agent navigate https://example.com
  browse-agent get-content --format text
  browse-agent get-dom "h1" --property innerText
  browse-agent evaluate "document.title"
  browse-agent screenshot fullPage --format png
  browse-agent tabs list
  browse-agent close
  browse-agent clear
  browse-agent skill ~/my-skills
`.trim(),
  );
}

function resolveSkillSourceDir(): string {
  const runtimeDir = dirname(fileURLToPath(import.meta.url));
  return join(runtimeDir, '..', 'skills');
}

function isNonEmptyDirectory(path: string): boolean {
  if (!existsSync(path)) return false;
  if (!statSync(path).isDirectory()) return true;
  return readdirSync(path).length > 0;
}

async function chooseSkillDestination(baseDir: string): Promise<string | null> {
  let targetName = 'browse-agent';

  while (true) {
    const targetDir = join(baseDir, targetName);
    if (!isNonEmptyDirectory(targetDir)) {
      return targetDir;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const action = (await rl.question(
      `Target directory "${targetDir}" already exists and is not empty. Choose [o]verwrite, [r]ename, or [c]ancel: `,
    )).trim().toLowerCase();

    if (action === 'o' || action === 'overwrite') {
      rmSync(targetDir, { recursive: true, force: true });
      rl.close();
      return targetDir;
    }

    if (action === 'r' || action === 'rename') {
      const nextName = (await rl.question('Enter a new directory name: ')).trim();
      rl.close();
      if (!nextName) {
        console.error('Directory name cannot be empty.');
        continue;
      }
      targetName = nextName;
      continue;
    }

    rl.close();
    return null;
  }
}

async function installSkill(targetBaseDir: string): Promise<void> {
  const sourceDir = resolveSkillSourceDir();
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Skill source directory not found: ${sourceDir}`);
  }

  const targetDir = await chooseSkillDestination(targetBaseDir);
  if (!targetDir) {
    console.log('Skill installation canceled.');
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  console.log(JSON.stringify({ success: true, source: sourceDir, target: targetDir }, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestService<T>(
  servicePort: number,
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${servicePort}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error || `Service request failed: ${method} ${path}`);
  }

  return payload;
}

async function isServiceHealthy(servicePort: number): Promise<boolean> {
  try {
    await requestService(servicePort, '/health', 'GET');
    return true;
  } catch {
    return false;
  }
}

function getRequestedServicePort(flags: Flags): number {
  return getNumberFlag(flags, 'servicePort') ?? DEFAULT_SERVICE_PORT;
}

interface ServiceRunningInfo {
  servicePort: number;
  newlyStarted: boolean;
}

async function ensureServiceRunning(flags: Flags): Promise<ServiceRunningInfo> {
  const requestedPort = getRequestedServicePort(flags);

  if (await isServiceHealthy(requestedPort)) {
    return { servicePort: requestedPort, newlyStarted: false };
  }

  const existing = loadServiceSession();
  if (existing && await isServiceHealthy(existing.servicePort)) {
    return { servicePort: existing.servicePort, newlyStarted: false };
  }

  const runtimeDir = dirname(fileURLToPath(import.meta.url));
  const serviceScript = join(runtimeDir, 'service.js');

  const child = spawn(
    process.execPath,
    [serviceScript, '--service-port', String(requestedPort)],
    { stdio: 'ignore', detached: true },
  );
  child.unref();

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await isServiceHealthy(requestedPort)) {
      return { servicePort: requestedPort, newlyStarted: true };
    }
    await sleep(200);
  }

  throw new Error('Failed to start background service.');
}

async function getRunningServicePort(flags: Flags): Promise<number> {
  const requestedPort = getRequestedServicePort(flags);
  if (await isServiceHealthy(requestedPort)) return requestedPort;

  const existing = loadServiceSession();
  if (existing && await isServiceHealthy(existing.servicePort)) return existing.servicePort;

  throw new Error('Service is not running. Run "browse-agent launch" first.');
}

async function runServiceCommand(
  flags: Flags,
  name: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const servicePort = await getRunningServicePort(flags);
  const result = await requestService<unknown>(servicePort, '/command', 'POST', { name, payload });
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2));
  }
}

const { command, positional, flags } = parseArgs(process.argv);

if (!command || flags.help || flags.h || command === 'help') {
  showHelp();
  process.exit(0);
}

const browser = getStringFlag(flags, 'browser');
const port = getStringFlag(flags, 'port');
const timeout = getStringFlag(flags, 'timeout');
if (browser) process.env.BROWSER = browser;
if (flags.headless) process.env.HEADLESS = 'true';
if (port) process.env.BROWSE_AGENT_PORT = port;
if (timeout) process.env.CONNECTION_TIMEOUT = timeout;

try {
  switch (command) {
    case 'setup': {
      await setup();
      break;
    }

    case 'launch': {
      const service = await ensureServiceRunning(flags);
      const servicePort = service.servicePort;
      const serverOnly = flags['server-only'] === true;

      if (serverOnly) {
        const status = await requestService<Record<string, unknown>>(servicePort, '/status', 'GET');
        console.log(JSON.stringify({ servicePort, mode: 'server-only', ...status }, null, 2));
        break;
      }

      if (!service.newlyStarted) {
        const status = await requestService<Record<string, unknown>>(servicePort, '/status', 'GET');
        if (status.running === true && status.connected === true) {
          console.log(JSON.stringify({ servicePort, skipped: 'service-and-browser-already-running', ...status }, null, 2));
          break;
        }
      }

      const opts: {
        browser?: 'chrome' | 'chromium' | 'edge' | 'brave';
        headless?: boolean;
        port?: number;
        timeout?: number;
      } = {};
      const launchBrowserFlag = getStringFlag(flags, 'browser') || 'chrome';
      const launchPort = getNumberFlag(flags, 'port');
      const launchTimeout = getNumberFlag(flags, 'timeout');
      if (launchBrowserFlag) opts.browser = launchBrowserFlag as 'chrome' | 'chromium' | 'edge' | 'brave';
      if (flags.headless) opts.headless = true;
      if (launchPort !== undefined) opts.port = launchPort;
      if (launchTimeout !== undefined) opts.timeout = launchTimeout;

      const result = await requestService<Record<string, unknown>>(servicePort, '/launch', 'POST', opts);
      console.log(JSON.stringify({ servicePort, ...result }, null, 2));
      break;
    }

    case 'connect': {
      const servicePort = await getRunningServicePort(flags);
      const status = await requestService<Record<string, unknown>>(servicePort, '/status', 'GET');
      console.log(JSON.stringify({ servicePort, ...status }, null, 2));
      break;
    }

    case 'close': {
      const servicePort = await getRunningServicePort(flags);
      const closeResult = await requestService<Record<string, unknown>>(servicePort, '/close', 'POST');
      const shutdownResult = await requestService<Record<string, unknown>>(servicePort, '/shutdown', 'POST');
      console.log(JSON.stringify({ servicePort, ...closeResult, ...shutdownResult }, null, 2));
      break;
    }

    case 'clear': {
      try {
        const servicePort = await getRunningServicePort(flags);
        await requestService(servicePort, '/shutdown', 'POST');
      } catch {
        // Service not running, continue clear.
      }
      await clear();
      break;
    }

    case 'skill': {
      const directory = positional[0];
      if (!directory) {
        console.error('Usage: browse-agent skill <directory>');
        process.exit(1);
      }

      const targetBaseDir = directory.startsWith('~')
        ? join(process.env.HOME || '', directory.replace(/^~[\\/]?/, ''))
        : resolve(directory);

      mkdirSync(targetBaseDir, { recursive: true });
      if (!statSync(targetBaseDir).isDirectory()) {
        throw new Error(`Target path is not a directory: ${targetBaseDir}`);
      }

      await installSkill(targetBaseDir);
      break;
    }

    case 'navigate': {
      const url = positional[0];
      if (!url) {
        console.error('Usage: browse-agent navigate <url>');
        process.exit(1);
      }
      await runServiceCommand(flags, 'navigate', { url });
      break;
    }

    case 'get-content': {
      const opts: { format?: string; tabId?: number } = {};
      const format = getStringFlag(flags, 'format');
      const tabId = getNumberFlag(flags, 'tabId');
      if (format) opts.format = format;
      if (tabId !== undefined) opts.tabId = tabId;
      await runServiceCommand(flags, 'get-content', { options: opts });
      break;
    }

    case 'get-dom': {
      const selector = positional[0];
      if (!selector) {
        console.error('Usage: browse-agent get-dom <selector>');
        process.exit(1);
      }
      const opts: { property?: string; all?: boolean; tabId?: number } = {};
      const property = getStringFlag(flags, 'property');
      const tabId = getNumberFlag(flags, 'tabId');
      if (property) opts.property = property;
      if (flags.all) opts.all = true;
      if (tabId !== undefined) opts.tabId = tabId;
      await runServiceCommand(flags, 'get-dom', { selector, options: opts });
      break;
    }

    case 'evaluate': {
      const expression = positional[0];
      if (!expression) {
        console.error('Usage: browse-agent evaluate <expression>');
        process.exit(1);
      }
      const opts: { tabId?: number } = {};
      const tabId = getNumberFlag(flags, 'tabId');
      if (tabId !== undefined) opts.tabId = tabId;
      await runServiceCommand(flags, 'evaluate', { expression, options: opts });
      break;
    }

    case 'inject-script': {
      const code = positional[0];
      if (!code) {
        console.error('Usage: browse-agent inject-script <code>');
        process.exit(1);
      }
      const opts: { tabId?: number } = {};
      const tabId = getNumberFlag(flags, 'tabId');
      if (tabId !== undefined) opts.tabId = tabId;
      await runServiceCommand(flags, 'inject-script', { code, options: opts });
      break;
    }

    case 'inject-css': {
      const code = positional[0];
      if (!code) {
        console.error('Usage: browse-agent inject-css <code>');
        process.exit(1);
      }
      const opts: { tabId?: number } = {};
      const tabId = getNumberFlag(flags, 'tabId');
      if (tabId !== undefined) opts.tabId = tabId;
      await runServiceCommand(flags, 'inject-css', { code, options: opts });
      break;
    }

    case 'screenshot': {
      const mode = positional[0] || 'visible';
      const opts: { format?: string; quality?: number; tabId?: number } = {};
      const format = getStringFlag(flags, 'format');
      const quality = getNumberFlag(flags, 'quality');
      const tabId = getNumberFlag(flags, 'tabId');
      if (format) opts.format = format;
      if (quality !== undefined) opts.quality = quality;
      if (tabId !== undefined) opts.tabId = tabId;
      await runServiceCommand(flags, 'screenshot', { mode, options: opts });
      break;
    }

    case 'tabs': {
      const action = positional[0] || 'list';
      const tabId = positional[1] ? Number(positional[1]) : undefined;

      switch (action) {
        case 'list':
          await runServiceCommand(flags, 'tabs-list');
          break;
        case 'close':
          if (tabId === undefined) {
            console.error('Usage: browse-agent tabs close <tabId>');
            process.exit(1);
          }
          await runServiceCommand(flags, 'tabs-close', { tabId });
          break;
        case 'activate':
          if (tabId === undefined) {
            console.error('Usage: browse-agent tabs activate <tabId>');
            process.exit(1);
          }
          await runServiceCommand(flags, 'tabs-activate', { tabId });
          break;
        default:
          console.error(`Unknown tabs action: ${action}. Use: list, close, activate`);
          process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}\\nRun "browse-agent --help" for usage.`);
      process.exit(1);
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[browse-agent] Error: ${message}`);
  process.exit(1);
}
