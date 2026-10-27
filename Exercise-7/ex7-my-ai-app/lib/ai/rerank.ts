import { CohereClientV2 } from 'cohere-ai';
import type { Source } from '../types';

export async function rerankWithCohere(query: string, sources: Source[], topN: number): Promise<Source[]> {
  if (sources.length === 0) {
    return sources;
  }

  try {
    const cohere = new CohereClientV2({ token: process.env.COHERE_API_KEY });
    const response = await cohere.rerank({
      model: 'rerank-v3.5',
      query,
      documents: sources.map((source) => source.content),
      topN,
    });

    return response.results.map((item) => ({ ...sources[item.index], score: item.relevanceScore }));
  } catch (error) {
    console.error('Cohere rerank failed, keeping the Pinecone order:', error);
    return sources.slice(0, topN);
  }
}
