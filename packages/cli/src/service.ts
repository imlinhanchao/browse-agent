import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { closeBrowser } from './scripts/close-browser';
import { clearServiceSession, DEFAULT_SERVICE_PORT, resolveOptions, saveServiceSession, type SessionData } from './scripts/config';
import { evaluate } from './scripts/evaluate';
import { getContent } from './scripts/get-content';
import { getDOM } from './scripts/get-dom';
import { injectCSS } from './scripts/inject-css';
import { injectScript } from './scripts/inject-script';
import { launchBrowser } from './scripts/launch-browser';
import { navigate } from './scripts/navigate';
import { screenshot } from './scripts/screenshot';
import { activateTab, closeTab, listTabs } from './scripts/tabs';

interface CommandRequest {
  name: string;
  payload?: Record<string, unknown>;
}

function toCommandRequest(value: Record<string, unknown>): CommandRequest {
  const name = value.name;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Invalid command request: "name" must be a non-empty string.');
  }

  const payloadRaw = value.payload;
  const payload =
    payloadRaw !== undefined && payloadRaw !== null && typeof payloadRaw === 'object'
      ? (payloadRaw as Record<string, unknown>)
      : undefined;

  return { name, payload };
}

let currentSession: SessionData | null = null;
let currentAgent: any | null = null;

function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getServicePort(): number {
  const index = process.argv.findIndex((arg) => arg === '--service-port');
  if (index !== -1 && process.argv[index + 1]) {
    const parsed = Number(process.argv[index + 1]);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return DEFAULT_SERVICE_PORT;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sessionInfo(session: SessionData | null): Record<string, unknown> {
  if (!session) return { running: false };
  const { _agent, _proc, ...info } = session;
  const connected = Boolean(_agent?.isConnected);
  return { running: true, connected, ...info };
}

async function handleLaunch(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (currentSession && currentAgent) {
    const connected = Boolean(currentAgent?.isConnected);
    const browserAlive = isProcessAlive(currentSession.pid);
    if (connected && browserAlive) {
      return sessionInfo(currentSession);
    }

    await stopBrowserSession();
  }

  const options = {
    browser: body.browser as 'chrome' | 'chromium' | 'edge' | 'brave' | undefined,
    headless: body.headless as boolean | undefined,
    port: body.port as number | undefined,
    timeout: body.timeout as number | undefined,
    secret: body.secret as string | undefined,
  };

  const session = await launchBrowser(options);
  currentSession = session;
  currentAgent = session._agent;

  const timeout = resolveOptions(options).timeout;
  await currentAgent.waitForConnection(timeout);

  return sessionInfo(session);
}

async function handleCommand(body: CommandRequest): Promise<unknown> {
  if (!currentAgent) {
    throw new Error('Service is running but browser session is not started. Run "browse-agent launch" first.');
  }

  const payload = body.payload ?? {};

  switch (body.name) {
    case 'navigate':
      return navigate(currentAgent, String(payload.url), (payload.options as Record<string, unknown>) ?? {});
    case 'get-content':
      return getContent(currentAgent, (payload.options as { format?: string; tabId?: number }) ?? {});
    case 'get-dom':
      return getDOM(
        currentAgent,
        String(payload.selector),
        (payload.options as { property?: string; all?: boolean; tabId?: number }) ?? {},
      );
    case 'evaluate':
      return evaluate(
        currentAgent,
        String(payload.expression),
        (payload.options as { tabId?: number }) ?? {},
      );
    case 'inject-script':
      return injectScript(
        currentAgent,
        String(payload.code),
        (payload.options as { tabId?: number }) ?? {},
      );
    case 'inject-css':
      return injectCSS(
        currentAgent,
        String(payload.code),
        (payload.options as { tabId?: number }) ?? {},
      );
    case 'screenshot':
      return screenshot(
        currentAgent,
        String(payload.mode ?? 'visible'),
        (payload.options as { format?: string; quality?: number; tabId?: number }) ?? {},
      );
    case 'tabs-list':
      return listTabs(currentAgent);
    case 'tabs-close':
      await closeTab(currentAgent, Number(payload.tabId));
      return { closed: Number(payload.tabId) };
    case 'tabs-activate':
      await activateTab(currentAgent, Number(payload.tabId));
      return { activated: Number(payload.tabId) };
    default:
      throw new Error(`Unknown command: ${body.name}`);
  }
}

async function stopBrowserSession(): Promise<void> {
  if (!currentSession && !currentAgent) return;

  await closeBrowser(currentAgent ?? undefined);
  currentSession = null;
  currentAgent = null;
}

const servicePort = getServicePort();

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    if (method === 'GET' && url === '/health') {
      writeJson(res, 200, { ok: true, servicePort, pid: process.pid });
      return;
    }

    if (method === 'GET' && url === '/status') {
      writeJson(res, 200, {
        servicePort,
        pid: process.pid,
        ...sessionInfo(currentSession),
      });
      return;
    }

    if (method === 'POST' && url === '/launch') {
      const body = await readJson(req);
      const result = await handleLaunch(body);
      writeJson(res, 200, result);
      return;
    }

    if (method === 'POST' && url === '/command') {
      const body = toCommandRequest(await readJson(req));
      const result = await handleCommand(body);
      writeJson(res, 200, result);
      return;
    }

    if (method === 'POST' && url === '/close') {
      await stopBrowserSession();
      writeJson(res, 200, { closed: true });
      return;
    }

    if (method === 'POST' && url === '/shutdown') {
      await stopBrowserSession();
      clearServiceSession();
      writeJson(res, 200, { stopped: true });
      server.close(() => {
        process.exit(0);
      });
      return;
    }

    writeJson(res, 404, { error: `Unknown route: ${method} ${url}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeJson(res, 500, { error: message });
  }
});

server.listen(servicePort, '127.0.0.1', () => {
  saveServiceSession({
    pid: process.pid,
    servicePort,
    startedAt: new Date().toISOString(),
  });
});

process.on('SIGINT', async () => {
  await stopBrowserSession();
  clearServiceSession();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopBrowserSession();
  clearServiceSession();
  process.exit(0);
});
