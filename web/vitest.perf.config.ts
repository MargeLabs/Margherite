import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Mesures de durée : un seul fichier à la fois, rien d'autre en parallèle dans le même lot (`npm run test:perf`).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.perf.test.ts'], environment: 'node', fileParallelism: false, pool: 'forks', poolOptions: { forks: { singleFork: true } } },
});
