/**
 * Connect to a running browse-agent session and verify the extension is responsive.
 *
 * Usage:
 *   import { connect } from './connect.mjs';
 *   const agent = await connect();         // reads session from state file
 *   const agent = await connect({ port: 9315, secret: '...' });
 *
 * CLI:
 *   node connect.mjs                       # check connection status
 */
import { loadSession, resolveOptions, importSdk } from './config.mjs';

export async function connect(options = {}) {
  const { BrowserAgent } = await importSdk();
  const session = loadSession();
  const port   = options.port   ?? session?.port   ?? resolveOptions().port;
  const secret = options.secret ?? session?.secret ?? resolveOptions().secret;
  const timeout = options.timeout ?? resolveOptions().timeout;

  const agent = new BrowserAgent({ secret, port });
  await agent.start();
  console.error(`[browse-agent] Connecting on port ${port}...`);

  await agent.waitForConnection(timeout);
  console.error('[browse-agent] Extension connected');

  return agent;
}

// CLI entry point — just verify connection then exit
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  try {
    const agent = await connect();
    const tabs = await agent.listTabs();
    console.log(JSON.stringify({
      connected: true,
      tabs: tabs.data.tabs.length,
    }, null, 2));
    await agent.stop();
  } catch (err) {
    console.log(JSON.stringify({ connected: false, error: err.message }));
    process.exit(1);
  }
}
