import { cleanExtensionWork, resolveOptions } from './config';
import { launchBrowser } from './launch-browser';

export { launchBrowser } from './launch-browser';
export { connect } from './connect';
export { closeBrowser } from './close-browser';
export { clear } from './clear';
export { navigate } from './navigate';
export { getContent } from './get-content';
export { getDOM } from './get-dom';
export { evaluate } from './evaluate';
export { injectScript } from './inject-script';
export { injectCSS } from './inject-css';
export { screenshot } from './screenshot';
export { listTabs, closeTab, activateTab } from './tabs';

interface BrowseOptions {
  browser?: 'chrome' | 'chromium' | 'edge' | 'brave';
  headless?: boolean;
  useUserProfile?: boolean;
  port?: number;
  timeout?: number;
  secret?: string;
  printResult?: boolean;
}

export async function browse(
  task: (agent: any) => Promise<unknown>,
  options: BrowseOptions = {},
): Promise<unknown> {
  const opts = resolveOptions(options);
  let session: any;
  let agent: any;
  let taskResult: unknown;

  try {
    session = await launchBrowser(opts);
    agent = session._agent;

    await agent.waitForConnection(opts.timeout);
    console.error('[browse-agent] Extension connected');

    taskResult = await task(agent);
    const shouldPrintResult = options.printResult !== false;
    if (shouldPrintResult && taskResult !== undefined) {
      console.log(JSON.stringify(taskResult, null, 2));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[browse-agent] Error:', message);
    process.exit(1);
  } finally {
    if (session?._proc) {
      try {
        session._proc.kill();
      } catch {
        // Ignore cleanup errors.
      }
    }
    if (agent) {
      try {
        await agent.stop();
      } catch {
        // Ignore cleanup errors.
      }
    }
    cleanExtensionWork();
  }

  return taskResult;
}
