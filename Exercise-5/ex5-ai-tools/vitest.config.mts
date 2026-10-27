import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      MONGODB_URI: 'mongodb://127.0.0.1:27017/ex5-ai-tools-test',
      OPENROUTER_API_KEY: 'test-key-never-sent',
      OMDB_API_KEY: '',
    },
  },
});
