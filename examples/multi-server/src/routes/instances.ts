import { Router } from 'express';
import { AppDataSource } from '../data-source.js';
import { InstanceSchema, type InstanceData } from '../entities/Instance.js';
import { agentManager } from '../manager.js';
import crypto from 'crypto';

const router = Router();

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function generateSecret(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** List all instances (without secrets). */
router.get('/', async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository<InstanceData>(InstanceSchema);
    const instances = await repo.find();
    instances.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(
      instances.map((i) => ({
        id: i.id,
        name: i.name,
        wsPort: i.wsPort,
        createdAt: i.createdAt,
        connected: agentManager.isConnected(i.id),
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Create a new instance. */
router.post('/', async (req, res) => {
  try {
    const { name, secret } = req.body ?? {};
    const wsPort = agentManager.allocatePort();
    const instance: InstanceData = {
      id: generateId(),
      name: name?.trim() || `Browser-${generateId().slice(0, 4)}`,
      secret: secret?.trim() || generateSecret(),
      wsPort,
      createdAt: new Date().toISOString(),
    };

    const repo = AppDataSource.getRepository<InstanceData>(InstanceSchema);
    await repo.save(instance);
    await agentManager.startAgent(instance);

    res.json({
      id: instance.id,
      name: instance.name,
      secret: instance.secret,
      wsPort: instance.wsPort,
      createdAt: instance.createdAt,
      connected: false,
    });
  } catch (e: any) {
    agentManager.releasePort(0); // no-op safety
    res.status(500).json({ error: e.message });
  }
});

/** Delete an instance. */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repo = AppDataSource.getRepository<InstanceData>(InstanceSchema);
    const instance = await repo.findOneBy({ id });
    if (!instance) return void res.status(404).json({ error: 'Instance not found' });

    await agentManager.stopAgent(id);
    agentManager.releasePort(instance.wsPort);
    await repo.delete({ id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Verify the secret for an instance (used by the control page auth gate). */
router.post('/:id/auth', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.body ?? {};
    const repo = AppDataSource.getRepository<InstanceData>(InstanceSchema);
    const instance = await repo.findOneBy({ id });
    if (!instance) return void res.status(404).json({ error: 'Instance not found' });

    const ok = typeof secret === 'string' && instance.secret === secret;
    res.json({ ok });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
