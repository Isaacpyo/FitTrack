import { defineConfig } from 'tsup';

// Bundle the API (and the TypeScript-source @fittrack/shared workspace package) into plain
// ESM for Node 22; npm dependencies stay external and are installed on the host.
export default defineConfig({
  entry: { server: 'src/server.ts', migrate: 'src/db/migrate-cli.ts', seed: 'src/db/seed-cli.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@fittrack/shared'],
});
