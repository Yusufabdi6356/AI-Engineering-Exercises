import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      MONGODB_URI: 'mongodb://127.0.0.1:27017/ex7-podcast-test',
      OPENROUTER_API_KEY: 'test-key-never-sent',
      PINECONE_API_KEY: 'test-pinecone-key',
      PINECONE_INDEX_NAME: 'ex7-podcast-test',
      COHERE_API_KEY: 'test-cohere-key',
    },
  },
});
