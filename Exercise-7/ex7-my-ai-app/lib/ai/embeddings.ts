import { embedMany } from 'ai';
import { openrouter } from './openrouter';
import { FriendlyError } from '../errors';

const embeddingModel = openrouter.textEmbeddingModel('openai/text-embedding-3-small');

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const { embeddings } = await embedMany({ model: embeddingModel, values: texts });
    return embeddings;
  } catch (error) {
    throw new FriendlyError('Could not create embeddings. Check OPENROUTER_API_KEY and your OpenRouter credit.', {
      cause: error,
    });
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}
