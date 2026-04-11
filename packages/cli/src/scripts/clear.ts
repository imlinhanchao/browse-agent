import { existsSync, rmSync } from 'node:fs';
import { BASE_DIR, loadSession } from './config';

export async function clear(): Promise<void> {
  const baseDir = BASE_DIR;

  console.log('Clearing browse-agent...');

  const session = loadSession();
  if (session?.pid) {
    try {
      process.kill(session.pid);
      console.log(`  Killed browser (PID: ${session.pid})`);
    } catch (err) {
      const killErr = err as NodeJS.ErrnoException;
      if (killErr.code !== 'ESRCH') {
        console.error(`  Failed to kill browser (PID: ${session.pid}):`, killErr.message);
      }
    }
  }

  if (existsSync(baseDir)) {
    rmSync(baseDir, { recursive: true });
    console.log(`  Removed ${baseDir}`);
  } else {
    console.log(`  ${baseDir} does not exist, skipping.`);
  }

  console.log('Done.\n');
}
