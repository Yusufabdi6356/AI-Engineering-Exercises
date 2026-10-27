import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        env: {
            OPENROUTER_API_KEY: 'test-key-never-sent',
            SERPER_API_KEY: 'test-serper-key',
        },
    },
});
