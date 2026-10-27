import { vi } from 'vitest';
import { simulateReadableStream } from 'ai';
import { MockEmbeddingModelV2, MockLanguageModelV2 } from 'ai/test';
import type { EmbeddingModelV2, LanguageModelV2, LanguageModelV2StreamPart } from '@ai-sdk/provider';

export const pineconeIndex = {
  upsert: vi.fn(),
  query: vi.fn(),
  deleteMany: vi.fn(),
};

export const cohereRerank = vi.fn();
export const speechCreate = vi.fn();

export const embed = vi.fn<EmbeddingModelV2<string>['doEmbed']>(async ({ values }) => ({
  embeddings: values.map(() => Array(1536).fill(0.01)),
}));

export const streamScript = vi.fn<LanguageModelV2['doStream']>();

export function scriptStream(pieces: string[], finishReason: 'stop' | 'length' | 'error' = 'stop') {
  const chunks: LanguageModelV2StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'text-1' },
    ...pieces.map((delta) => ({ type: 'text-delta' as const, id: 'text-1', delta })),
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
  ];

  return { stream: simulateReadableStream({ chunks, chunkDelayInMs: 5 }) };
}

export const languageModel = new MockLanguageModelV2({ doStream: (options) => streamScript(options) });
export const embeddingModel = new MockEmbeddingModelV2<string>({
  maxEmbeddingsPerCall: 100,
  doEmbed: (options) => embed(options),
});

export const pineconeModule = {
  Pinecone: class {
    index() {
      return pineconeIndex;
    }
  },
};

export const cohereModule = {
  CohereClientV2: class {
    rerank = cohereRerank;
  },
};

export const openaiModule = {
  default: class {
    audio = { speech: { create: speechCreate } };
  },
};

export const openrouterModule = {
  openrouter: {
    chat: () => languageModel,
    textEmbeddingModel: () => embeddingModel,
  },
};
