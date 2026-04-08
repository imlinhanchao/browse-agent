#!/usr/bin/env node
/**
 * CLI entry point for browse-agent skill.
 *
 * Usage:
 *   browse-agent <command> [options]
 *
 * Commands:
 *   setup                Setup browse-agent (install SDK + extension)
 *   launch               Launch browser with extension
 *   connect              Connect to running browser session
 *   close                Close browser and clean up session
 *   navigate <url>       Navigate to URL
 *   get-content          Get page content
 *   get-dom <selector>   Query DOM elements
 *   evaluate <expr>      Evaluate JavaScript expression
 *   inject-script <code> Inject and execute JavaScript
 *   inject-css <code>    Inject CSS stylesheet
 *   screenshot [mode]    Take screenshot (visible|fullPage|area)
 *   tabs [action] [id]   Manage tabs (list|close|activate)
 *   clear                Remove browse-agent installation
 *
 * Global options:
 *   --global             Use global installation (~/.browse-agent)
 *   --browser <name>     Browser: chrome|chromium|edge|brave
 *   --headless           Run headless
 *   --port <number>      WebSocket port (default: 9315)
 *   --tabId <id>         Target tab ID (feature commands)
 *   --format <type>      Content/screenshot format
 *   --property <prop>    DOM property (get-dom)
 *   --all                Return all DOM matches (get-dom)
 *   --quality <num>      Screenshot quality 1-100 (jpeg)
 *   --timeout <ms>       Connection timeout
 *   --help, -h           Show help
 */

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.find(a => !a.startsWith('-'));
  const positional = args.filter(a => !a.startsWith('-'));
  const flags = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--global')   { flags.global = true; continue; }
    if (arg === '--headless') { flags.headless = true; continue; }
    if (arg === '--all')      { flags.all = true; continue; }
    if (arg.startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('-')) {
      flags[arg.slice(2)] = args[++i];
      continue;
    }
  }

  return { command, positional: positional.slice(1), flags };
}

function showHelp() {
  console.log(`
browse-agent — Browser automation skill CLI

Usage: browse-agent <command> [options]

Lifecycle commands:
  setup                Install SDK and Chrome extension
  launch               Launch browser with extension loaded
  connect              Verify connection to running browser
  close                Close browser and clean up session
  clear                Remove installation and dependencies

Feature commands (require a running browser session):
  navigate <url>       Navigate to URL
  get-content          Get page content (HTML or text)
  get-dom <selector>   Query DOM elements
  evaluate <expr>      Evaluate JavaScript expression
  inject-script <code> Inject and execute JavaScript
  inject-css <code>    Inject CSS stylesheet
  screenshot [mode]    Capture screenshot (visible|fullPage|area)
  tabs [action] [id]   Manage tabs (list|close|activate)

Options:
  --global             Use global installation (~/.browse-agent)
  --browser <name>     Browser: chrome | chromium | edge | brave (default: chrome)
  --headless           Run in headless mode
  --port <number>      WebSocket port (default: 9315)
  --tabId <id>         Target tab ID (from navigate or tabs list output)
  --format <type>      Content/screenshot format (text|html / png|jpeg)
  --property <prop>    DOM property: outerHTML | innerHTML | innerText
  --all                Return all DOM matches instead of first only
  --quality <num>      Screenshot quality (1-100, jpeg only)
  --timeout <ms>       Connection timeout in ms
  --help, -h           Show this help

Examples:
  browse-agent setup
  browse-agent setup --global
  browse-agent launch --browser edge --headless
  browse-agent navigate https://example.com
  browse-agent get-content --format text
  browse-agent get-dom "h1" --property innerText
  browse-agent evaluate "document.title"
  browse-agent screenshot fullPage --format png
  browse-agent tabs list
  browse-agent close
  browse-agent clear --global
`.trim());
}

// ── Connect helper for feature commands ───────────────────────────────────────

async function withAgent(flags, fn) {
  const { connect } = await import('./scripts/connect.mjs');
  const connectOpts = {};
  if (flags.port) connectOpts.port = Number(flags.port);
  if (flags.timeout) connectOpts.timeout = Number(flags.timeout);

  const agent = await connect(connectOpts);
  try {
    const result = await fn(agent);
    if (result !== undefined) {
      console.log(JSON.stringify(result, null, 2));
    }
  } finally {
    await agent.stop();
  }
}

// ── Command dispatch ──────────────────────────────────────────────────────────

const { command, positional, flags } = parseArgs(process.argv);

if (!command || flags.help || flags.h || command === 'help') {
  showHelp();
  process.exit(0);
}

// Auto-detect global mode: if skill is not inside cwd, default to global
import { isSkillInCwd } from './scripts/config.mjs';

// Set env vars from flags for scripts that read them
if (flags.global || !isSkillInCwd()) process.env.BROWSE_AGENT_GLOBAL = 'true';
if (flags.browser)  process.env.BROWSER = flags.browser;
if (flags.headless) process.env.HEADLESS = 'true';
if (flags.port)     process.env.BROWSE_AGENT_PORT = flags.port;
if (flags.timeout)  process.env.CONNECTION_TIMEOUT = flags.timeout;

try {
  switch (command) {
    // ── Lifecycle ───────────────────────────────────────────────────────────
    case 'setup': {
      const { setup } = await import('./scripts/setup.mjs');
      await setup({ global: flags.global || undefined });
      break;
    }

    case 'launch': {
      const { launchBrowser } = await import('./scripts/launch-browser.mjs');
      const opts = {};
      if (flags.browser)  opts.browser = flags.browser;
      if (flags.headless) opts.headless = true;
      if (flags.port)     opts.port = Number(flags.port);
      const session = await launchBrowser(opts);
      const { _agent, _proc, ...info } = session;
      console.log(JSON.stringify(info, null, 2));
      await _agent.stop();
      showHelp();
      break;
    }

    case 'connect': {
      const { connect } = await import('./scripts/connect.mjs');
      const opts = {};
      if (flags.port) opts.port = Number(flags.port);
      if (flags.timeout) opts.timeout = Number(flags.timeout);
      const agent = await connect(opts);
      const tabs = await agent.listTabs();
      console.log(JSON.stringify({ connected: true, tabs: tabs.tabs.length }, null, 2));
      await agent.stop();
      break;
    }

    case 'close': {
      const { closeBrowser } = await import('./scripts/close-browser.mjs');
      await closeBrowser();
      console.log(JSON.stringify({ closed: true }));
      break;
    }

    case 'clear': {
      const { clear } = await import('./scripts/clear.mjs');
      await clear({ global: flags.global || undefined });
      break;
    }

    // ── Feature commands ────────────────────────────────────────────────────
    case 'navigate': {
      const url = positional[0];
      if (!url) { console.error('Usage: browse-agent navigate <url>'); process.exit(1); }
      const { navigate } = await import('./scripts/navigate.mjs');
      await withAgent(flags, agent => navigate(agent, url));
      break;
    }

    case 'get-content': {
      const { getContent } = await import('./scripts/get-content.mjs');
      const opts = {};
      if (flags.format) opts.format = flags.format;
      if (flags.tabId)  opts.tabId = Number(flags.tabId);
      await withAgent(flags, agent => getContent(agent, opts));
      break;
    }

    case 'get-dom': {
      const selector = positional[0];
      if (!selector) { console.error('Usage: browse-agent get-dom <selector>'); process.exit(1); }
      const { getDOM } = await import('./scripts/get-dom.mjs');
      const opts = {};
      if (flags.property) opts.property = flags.property;
      if (flags.all)      opts.all = true;
      if (flags.tabId)    opts.tabId = Number(flags.tabId);
      await withAgent(flags, agent => getDOM(agent, selector, opts));
      break;
    }

    case 'evaluate': {
      const expr = positional[0];
      if (!expr) { console.error('Usage: browse-agent evaluate <expression>'); process.exit(1); }
      const { evaluate } = await import('./scripts/evaluate.mjs');
      const opts = {};
      if (flags.tabId) opts.tabId = Number(flags.tabId);
      await withAgent(flags, agent => evaluate(agent, expr, opts));
      break;
    }

    case 'inject-script': {
      const code = positional[0];
      if (!code) { console.error('Usage: browse-agent inject-script <code>'); process.exit(1); }
      const { injectScript } = await import('./scripts/inject-script.mjs');
      const opts = {};
      if (flags.tabId) opts.tabId = Number(flags.tabId);
      await withAgent(flags, agent => injectScript(agent, code, opts));
      break;
    }

    case 'inject-css': {
      const code = positional[0];
      if (!code) { console.error('Usage: browse-agent inject-css <code>'); process.exit(1); }
      const { injectCSS } = await import('./scripts/inject-css.mjs');
      const opts = {};
      if (flags.tabId) opts.tabId = Number(flags.tabId);
      await withAgent(flags, agent => injectCSS(agent, code, opts));
      break;
    }

    case 'screenshot': {
      const mode = positional[0] || 'visible';
      const { screenshot } = await import('./scripts/screenshot.mjs');
      const opts = {};
      if (flags.format)  opts.format = flags.format;
      if (flags.quality) opts.quality = Number(flags.quality);
      if (flags.tabId)   opts.tabId = Number(flags.tabId);
      await withAgent(flags, agent => screenshot(agent, mode, opts));
      break;
    }

    case 'tabs': {
      const action = positional[0] || 'list';
      const tabId = positional[1] ? Number(positional[1]) : undefined;
      const { listTabs, closeTab, activateTab } = await import('./scripts/tabs.mjs');

      await withAgent(flags, async (agent) => {
        switch (action) {
          case 'list':
            return listTabs(agent);
          case 'close':
            if (tabId === undefined) { console.error('Usage: browse-agent tabs close <tabId>'); process.exit(1); }
            await closeTab(agent, tabId);
            return { closed: tabId };
          case 'activate':
            if (tabId === undefined) { console.error('Usage: browse-agent tabs activate <tabId>'); process.exit(1); }
            await activateTab(agent, tabId);
            return { activated: tabId };
          default:
            console.error(`Unknown tabs action: ${action}. Use: list, close, activate`);
            process.exit(1);
        }
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}\nRun "browse-agent --help" for usage.`);
      process.exit(1);
  }
} catch (err) {
  console.error(`[browse-agent] Error: ${err.message}`);
  process.exit(1);
}
