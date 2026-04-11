import { importSdk, loadSession, resolveOptions } from './config';

interface ConnectOptions {
  port?: number;
  secret?: string;
  timeout?: number;
}

export async function connect(options: ConnectOptions = {}): Promise<any> {
  const { BrowserAgent } = await importSdk();
  const session = loadSession();
  const port = options.port ?? session?.port ?? resolveOptions().port;
  const secret = options.secret ?? session?.secret ?? resolveOptions().secret;
  const timeout = options.timeout ?? resolveOptions().timeout;

  const agent = new BrowserAgent({ secret, port });
  await agent.start();
  console.error(`[browse-agent] Connecting on port ${port}...`);

  await agent.waitForConnection(timeout);
  console.error('[browse-agent] Extension connected');

  return agent;
}
