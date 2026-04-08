#!/usr/bin/env node
/**
 * Clear browse-agent installation: remove extension, SDK, session data.
 *
 * Usage:
 *   import { clear } from './clear.mjs';
 *   await clear();                // clear local installation
 *   await clear({ global: true }); // clear global installation
 *
 * CLI:
 *   node clear.mjs               # clear local
 *   node clear.mjs --global      # clear global (~/.browse-agent)
 */
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { GLOBAL_BASE_DIR, LOCAL_BASE_DIR, loadSession, isSkillInCwd } from './config.mjs';

export async function clear(options = {}) {
  const isGlobal = options.global !== undefined ? options.global : !isSkillInCwd();
  const baseDir = isGlobal ? GLOBAL_BASE_DIR : LOCAL_BASE_DIR;

  console.log(`Clearing browse-agent${isGlobal ? ' (global)' : ''}...`);

  // 1. Kill any running browser session
  const session = loadSession();
  if (session?.pid) {
    try {
      process.kill(session.pid);
      console.log(`  Killed browser (PID: ${session.pid})`);
    } catch (err) {
      if (err.code !== 'ESRCH') {
        console.error(`  Failed to kill browser (PID: ${session.pid}):`, err.message);
      }
    }
  }

  // 2. Remove base directory (extension, profile, session, working copy)
  if (existsSync(baseDir)) {
    rmSync(baseDir, { recursive: true });
    console.log(`  Removed ${baseDir}`);
  } else {
    console.log(`  ${baseDir} does not exist, skipping.`);
  }

  // 3. Uninstall SDK
  if (isGlobal) {
    // Global SDK is inside ~/.browse-agent/node_modules/, already removed above
    console.log('  SDK removed (was inside global directory).');
  } else {
    try {
      execSync('npm uninstall browse-agent-sdk', { stdio: 'pipe' });
      console.log('  Uninstalled browse-agent-sdk from project.');
    } catch {
      console.log('  browse-agent-sdk was not installed locally, skipping.');
    }
  }

  console.log('Done.\n');
}

// CLI entry point
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const hasGlobalFlag = process.argv.includes('--global');
  await clear({ global: hasGlobalFlag ? true : undefined });
}
