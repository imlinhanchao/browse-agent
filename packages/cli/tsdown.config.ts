import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts', 'src/service.ts', 'src/script.ts'],
  format: ['esm'],
  dts: true,
  hash: false,
  outDir: 'dist',
  clean: true,
  platform: 'node',
});
