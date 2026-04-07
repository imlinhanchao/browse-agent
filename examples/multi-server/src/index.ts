import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppDataSource } from './data-source.js';
import { InstanceSchema, type InstanceData } from './entities/Instance.js';
import { agentManager } from './manager.js';
import instancesRouter from './routes/instances.js';
import controlRouter from './routes/control.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);

async function start() {
  // ── Database ────────────────────────────────────────────
  await AppDataSource.initialize();
  console.log('[DB] SQLite database initialized');

  // ── Restore existing instances ──────────────────────────
  const repo = AppDataSource.getRepository<InstanceData>(InstanceSchema);
  const instances = await repo.find();
  for (const instance of instances) {
    agentManager.reservePort(instance.wsPort);
    try {
      await agentManager.startAgent(instance);
    } catch (err: any) {
      console.error(`[Manager] Failed to restore instance "${instance.name}" on port ${instance.wsPort}: ${err.message}`);
    }
  }
  console.log(`[Manager] Restored ${instances.length} instance(s)`);

  // ── Express ─────────────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/instances', instancesRouter);
  app.use('/api/instances', controlRouter);

  // Serve built Vue client
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // SPA fallback for client-side routing
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Multi-instance Browse Agent server: http://localhost:${HTTP_PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
