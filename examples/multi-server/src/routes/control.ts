import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppDataSource } from '../data-source.js';
import { InstanceSchema, type InstanceData } from '../entities/Instance.js';
import { agentManager } from '../manager.js';

const router = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────

async function requireSecret(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const secret = req.headers['x-secret'];

  if (!secret) {
    return void res.status(401).json({ error: 'X-Secret header required' });
  }

  const repo = AppDataSource.getRepository<InstanceData>(InstanceSchema);
  const instance = await repo.findOneBy({ id });
  if (!instance) {
    return void res.status(404).json({ error: 'Instance not found' });
  }

  if (instance.secret !== String(secret)) {
    return void res.status(403).json({ error: 'Invalid secret' });
  }

  next();
}

// ── Status ─────────────────────────────────────────────────────────────────────

router.get('/:id/status', requireSecret, (req: Request, res: Response) => {
  res.json({ connected: agentManager.isConnected(req.params.id) });
});

// ── Tabs ───────────────────────────────────────────────────────────────────────

router.get('/:id/tabs', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    res.json(await agent.listTabs());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Navigate ───────────────────────────────────────────────────────────────────

router.post('/:id/navigate', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { url, waitForLoad, timeout } = req.body;
    if (!url) return void res.status(400).json({ error: 'url is required' });
    res.json(await agent.navigate(url, { waitForLoad, timeout }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Evaluate ───────────────────────────────────────────────────────────────────

router.post('/:id/evaluate', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { expression, tabId } = req.body;
    if (!expression) return void res.status(400).json({ error: 'expression is required' });
    res.json(await agent.evaluate(expression, tabId));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Close Tab ──────────────────────────────────────────────────────────────────

router.post('/:id/closeTab', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { tabId } = req.body;
    if (tabId === undefined) return void res.status(400).json({ error: 'tabId is required' });
    await agent.closeTab(tabId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Activate Tab ───────────────────────────────────────────────────────────────

router.post('/:id/activateTab', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { tabId } = req.body;
    if (tabId === undefined) return void res.status(400).json({ error: 'tabId is required' });
    await agent.activateTab(tabId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Screenshot (visible) ───────────────────────────────────────────────────────

router.post('/:id/screenshotVisible', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { tabId, format, quality } = req.body;
    res.json(await agent.screenshotVisible({ tabId, format, quality }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Screenshot (full page) ─────────────────────────────────────────────────────

router.post('/:id/screenshotFullPage', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { tabId, format, quality } = req.body;
    res.json(await agent.screenshotFullPage({ tabId, format, quality }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Inject Script ──────────────────────────────────────────────────────────────

router.post('/:id/injectScript', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { code, tabId } = req.body;
    if (!code) return void res.status(400).json({ error: 'code is required' });
    res.json(await agent.injectScript(code, tabId));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get Content ────────────────────────────────────────────────────────────────

router.post('/:id/getContent', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { tabId, format } = req.body;
    res.json(await agent.getContent({ tabId, format }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get DOM ────────────────────────────────────────────────────────────────────

router.post('/:id/getDOM', requireSecret, async (req: Request, res: Response) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return void res.status(404).json({ error: 'Agent not found' });
  try {
    const { selector, tabId, property, all } = req.body;
    if (!selector) return void res.status(400).json({ error: 'selector is required' });
    res.json(await agent.getDOM(selector, { tabId, property, all }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
