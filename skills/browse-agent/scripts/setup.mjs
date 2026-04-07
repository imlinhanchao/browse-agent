#!/usr/bin/env node
/**
 * Setup script for browse-agent skill.
 * Installs browse-agent-sdk and downloads the Chrome extension.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE_DIR = join(process.cwd(), '.browse-agent');
const EXTENSION_DIR = join(BASE_DIR, 'extension');
const ZIP_PATH = join(BASE_DIR, 'extension.zip');

console.log('Setting up browse-agent...\n');

// 1. Install SDK
console.log('[1/3] Installing browse-agent-sdk...');
execSync('npm install browse-agent-sdk', { stdio: 'inherit' });

// 2. Create directories
mkdirSync(BASE_DIR, { recursive: true });

// 3. Download extension from latest release
console.log('\n[2/3] Downloading Chrome extension from latest release...');
const releaseApi = 'https://api.github.com/repos/imlinhanchao/browse-agent/releases/latest';
const releaseJson = execSync(`curl -s "${releaseApi}"`).toString();
const releaseInfo = JSON.parse(releaseJson);
const asset = releaseInfo.assets?.find(a => a.name.endsWith('.zip'));
if (!asset) {
  console.error('Error: No extension zip found in latest release.');
  console.error('Visit https://github.com/imlinhanchao/browse-agent/releases to check.');
  process.exit(1);
}
console.log(`  Downloading ${asset.name} (${(asset.size / 1024).toFixed(1)} KB)...`);
execSync(`curl -sL -o "${ZIP_PATH}" "${asset.browser_download_url}"`);

// 4. Extract extension
console.log('\n[3/3] Extracting extension...');
if (existsSync(EXTENSION_DIR)) {
  execSync(`rm -rf "${EXTENSION_DIR}"`);
}
mkdirSync(EXTENSION_DIR, { recursive: true });
execSync(`unzip -o "${ZIP_PATH}" -d "${EXTENSION_DIR}"`, { stdio: 'pipe' });
unlinkSync(ZIP_PATH);

// Verify extraction
const files = readdirSync(EXTENSION_DIR);
if (!files.includes('manifest.json')) {
  // Check if files are in a subdirectory
  const subdirs = files.filter(f => {
    try { return readdirSync(join(EXTENSION_DIR, f)).includes('manifest.json'); } catch { return false; }
  });
  if (subdirs.length > 0) {
    // Move files up from subdirectory
    const subdir = join(EXTENSION_DIR, subdirs[0]);
    execSync(`mv "${subdir}"/* "${EXTENSION_DIR}"/`);
    execSync(`rmdir "${subdir}"`);
  } else {
    console.error('Error: Extension extraction failed — manifest.json not found.');
    process.exit(1);
  }
}

console.log('\nSetup complete!');
console.log(`  Extension path: ${EXTENSION_DIR}`);
console.log('  SDK: browse-agent-sdk (npm)\n');
console.log('Add .browse-agent/ to your .gitignore.');
