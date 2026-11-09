import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // les mesures de durée tournent à part (vitest.perf.config.ts) : en parallèle avec les autres fichiers, elles mesurent la charge de la machine
  test: { include: ['src/**/*.test.ts'], exclude: [...configDefaults.exclude, 'src/**/*.perf.test.ts'], environment: 'node' },
});
