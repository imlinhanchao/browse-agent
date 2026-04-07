/**
 * Close the browser and clean up the browse-agent session.
 *
 * Usage:
 *   import { closeBrowser } from './close-browser.mjs';
 *   await closeBrowser();       // reads PID from session state
 *   await closeBrowser(agent);  // also stops the agent
 *
 * CLI:
 *   node close-browser.mjs
 */
import { loadSession, clearSession, cleanExtensionWork } from './config.mjs';

export async function closeBrowser(agent) {
  const session = loadSession();

  // Kill browser process
  if (session?.pid) {
    try {
      process.kill(session.pid);
      console.error(`[browse-agent] Browser (PID: ${session.pid}) killed`);
    } catch (err) {
      if (err.code === 'ESRCH') {
        console.error(`[browse-agent] Browser (PID: ${session.pid}) already exited`);
      } else {
        console.error(`[browse-agent] Failed to kill browser:`, err.message);
      }
    }
  }

  // Stop agent if provided
  if (agent) {
    try { await agent.stop(); } catch {}
  }

  // Clean up
  cleanExtensionWork();
  clearSession();
  console.error('[browse-agent] Session cleaned up');
}

// CLI entry point
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  await closeBrowser();
  console.log(JSON.stringify({ closed: true }));
}
