/**
 * Express Debug Server — Interactive frontend for testing all browse-agent-sdk APIs.
 *
 * Usage:
 *   1. npm run build
 *   2. Load extension in Chrome & configure secret
 *   3. node examples/debug-server.mjs
 *   4. Open http://localhost:3000 in browser
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { BrowserAgent } from '../packages/sdk/dist/index.js';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET = process.env.BROWSE_AGENT_SECRET || 'debug-secret';
const WS_PORT = parseInt(process.env.WS_PORT || '9315', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);

const agent = new BrowserAgent({ secret: SECRET, port: WS_PORT, timeout: 60000 });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'debug-public')));

// ── Status ──────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ connected: agent.isConnected });
});

// ── Navigate ────────────────────────────────────────────
app.post('/api/navigate', async (req, res) => {
  try {
    const { url, waitForLoad, timeout } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const result = await agent.navigate(url, { waitForLoad, timeout });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get Content ─────────────────────────────────────────
app.post('/api/getContent', async (req, res) => {
  try {
    const { tabId, format } = req.body;
    const result = await agent.getContent({ tabId, format });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── List Tabs ───────────────────────────────────────────
app.get('/api/tabs', async (_req, res) => {
  try {
    const result = await agent.listTabs();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Close Tab ───────────────────────────────────────────
app.post('/api/closeTab', async (req, res) => {
  try {
    const { tabId } = req.body;
    if (tabId === undefined) return res.status(400).json({ error: 'tabId is required' });
    await agent.closeTab(tabId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Activate Tab ────────────────────────────────────────
app.post('/api/activateTab', async (req, res) => {
  try {
    const { tabId } = req.body;
    if (tabId === undefined) return res.status(400).json({ error: 'tabId is required' });
    await agent.activateTab(tabId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Inject Script ───────────────────────────────────────
app.post('/api/injectScript', async (req, res) => {
  try {
    const { code, tabId } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    const result = await agent.injectScript(code, tabId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Inject CSS ──────────────────────────────────────────
app.post('/api/injectCSS', async (req, res) => {
  try {
    const { code, tabId } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    await agent.injectCSS(code, tabId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Evaluate ────────────────────────────────────────────
app.post('/api/evaluate', async (req, res) => {
  try {
    const { expression, tabId } = req.body;
    if (!expression) return res.status(400).json({ error: 'expression is required' });
    const result = await agent.evaluate(expression, tabId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get DOM ─────────────────────────────────────────────
app.post('/api/getDOM', async (req, res) => {
  try {
    const { selector, tabId, property, all } = req.body;
    if (!selector) return res.status(400).json({ error: 'selector is required' });
    const result = await agent.getDOM(selector, { tabId, property, all });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Screenshot (visible) ────────────────────────────────
app.post('/api/screenshotVisible', async (req, res) => {
  try {
    const { tabId, format, quality } = req.body;
    const result = await agent.screenshotVisible({ tabId, format, quality });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Screenshot (full page) ──────────────────────────────
app.post('/api/screenshotFullPage', async (req, res) => {
  try {
    const { tabId, format, quality } = req.body;
    const result = await agent.screenshotFullPage({ tabId, format, quality });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Screenshot (area) ───────────────────────────────────
app.post('/api/screenshotArea', async (req, res) => {
  try {
    const { tabId, format, quality, x, y, width, height } = req.body;
    if (x == null || y == null || width == null || height == null) {
      return res.status(400).json({ error: 'x, y, width, height are required' });
    }
    const result = await agent.screenshotArea({ x, y, width, height }, { tabId, format, quality });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ───────────────────────────────────────────────
async function start() {
  await agent.start();
  console.log(`[WS] Browse Agent WebSocket server on ws://127.0.0.1:${WS_PORT}`);
  console.log(`[WS] Secret: "${SECRET}"`);

  agent.onDisconnected(() => console.log('[WS] Extension disconnected'));

  app.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Debug UI: http://localhost:${HTTP_PORT}`);
    console.log('\nWaiting for Chrome extension to connect...');
  });
}

start().catch(console.error);
