import { clearSession, cleanExtensionWork, loadSession } from './config';

export async function closeBrowser(agent?: { stop?: () => Promise<void> }): Promise<void> {
  const session = loadSession();

  if (session?.pid) {
    try {
      process.kill(session.pid);
      console.error(`[browse-agent] Browser (PID: ${session.pid}) killed`);
    } catch (err) {
      const killErr = err as NodeJS.ErrnoException;
      if (killErr.code === 'ESRCH') {
        console.error(`[browse-agent] Browser (PID: ${session.pid}) already exited`);
      } else {
        console.error('[browse-agent] Failed to kill browser:', killErr.message);
      }
    }
  }

  if (agent?.stop) {
    try {
      await agent.stop();
    } catch {
      // Ignore cleanup errors.
    }
  }

  cleanExtensionWork();
  clearSession();
  console.error('[browse-agent] Session cleaned up');
}
