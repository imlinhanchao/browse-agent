import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_DIR } from './config';

export async function setup(): Promise<void> {
  const baseDir = BASE_DIR;
  const extensionDir = join(baseDir, 'extension');
  const zipPath = join(baseDir, 'extension.zip');

  const extensionInstalled = existsSync(join(extensionDir, 'manifest.json'));

  if (extensionInstalled) {
    console.log('browse-agent is already set up.');
    console.log(`  Extension path: ${extensionDir}`);
    console.log('  Extension: installed\n');
    return;
  }

  console.log('Setting up browse-agent...\n');

  mkdirSync(baseDir, { recursive: true });

  if (extensionInstalled) {
    console.log('\n[1/2] Downloading Chrome extension from latest release...');
    console.log('  Skipped: extension is already installed.');
    console.log('\n[2/2] Extracting extension...');
    console.log('  Skipped: extension is already installed.');
  } else {
    console.log('\n[1/2] Downloading Chrome extension from latest release...');
    const releaseApi = 'https://api.github.com/repos/imlinhanchao/browse-agent/releases/latest';
    const releaseJson = execSync(`curl -s "${releaseApi}"`).toString();
    const releaseInfo = JSON.parse(releaseJson) as {
      assets?: Array<{ name: string; size: number; browser_download_url: string }>;
    };
    const asset = releaseInfo.assets?.find((item) => item.name.endsWith('.zip'));

    if (!asset) {
      console.error('Error: No extension zip found in latest release.');
      console.error('Visit https://github.com/imlinhanchao/browse-agent/releases to check.');
      process.exit(1);
    }

    console.log(`  Downloading ${asset.name} (${(asset.size / 1024).toFixed(1)} KB)...`);
    execSync(`curl -sL -o "${zipPath}" "${asset.browser_download_url}"`);

    console.log('\n[2/2] Extracting extension...');
    if (existsSync(extensionDir)) {
      execSync(`rm -rf "${extensionDir}"`);
    }
    mkdirSync(extensionDir, { recursive: true });
    execSync(`unzip -o "${zipPath}" -d "${extensionDir}"`, { stdio: 'pipe' });
    unlinkSync(zipPath);

    const files = readdirSync(extensionDir);
    if (!files.includes('manifest.json')) {
      const subdirs = files.filter((file) => {
        try {
          return readdirSync(join(extensionDir, file)).includes('manifest.json');
        } catch {
          return false;
        }
      });

      if (subdirs.length > 0) {
        const subdir = join(extensionDir, subdirs[0]);
        execSync(`mv "${subdir}"/* "${extensionDir}"/`);
        execSync(`rmdir "${subdir}"`);
      } else {
        console.error('Error: Extension extraction failed - manifest.json not found.');
        process.exit(1);
      }
    }
  }

  console.log('\nSetup complete!');
  console.log(`  Extension path: ${extensionDir}`);
  console.log('  Extension: installed\n');
}
