import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ quiet: true });

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Add your OPENROUTER_API_KEY to the .env file first.');
  process.exit(1);
}

export const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  maxRetries: 0
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (task, attempts = 3) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      const retryable = !error.status || error.status === 429 || error.status >= 500;

      if (!retryable || attempt === attempts) throw error;

      const delay = 1000 * 2 ** (attempt - 1);
      console.log(`  Attempt ${attempt} failed (${error.message}). Retrying in ${delay / 1000}s...`);
      await wait(delay);
    }
  }
};

export const withFallback = async (models, task) => {
  let lastError;

  for (const model of models) {
    try {
      const result = await withRetry(() => task(model));
      return { model, result };
    } catch (error) {
      lastError = error;
      console.log(`  ${model} failed: ${error.message}`);

      if (model !== models[models.length - 1]) {
        console.log(`  Falling back to ${models[models.indexOf(model) + 1]}`);
      }
    }
  }

  throw lastError;
};
