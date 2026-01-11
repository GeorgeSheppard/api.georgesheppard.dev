import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core/queue/worker.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  tsconfig: './tsconfig.json',
});
