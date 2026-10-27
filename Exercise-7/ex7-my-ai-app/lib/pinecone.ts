import { Pinecone } from '@pinecone-database/pinecone';
import { FriendlyError } from './errors';
import type { Chunk, Source } from './types';

const keyHint = 'Check PINECONE_API_KEY and that the index exists with 1536 dimensions.';

let pinecone: Pinecone | null = null;

function getIndex() {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return pinecone.index(process.env.PINECONE_INDEX_NAME!);
}

export async function storeVectors(
  documentId: string,
  chunks: Chunk[],
  embeddings: number[][],
  metadata: { title: string; filename: string }
): Promise<void> {
  const vectors = chunks.map((chunk, i) => ({
    id: `${documentId}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      documentId,
      chunkIndex: i,
      page: chunk.page,
      content: chunk.content,
      title: metadata.title,
      filename: metadata.filename,
    },
  }));

  try {
    const index = getIndex();
    for (let i = 0; i < vectors.length; i += 100) {
      await index.upsert(vectors.slice(i, i + 100));
    }
  } catch (error) {
    throw new FriendlyError(`Failed to store vectors in Pinecone. ${keyHint}`, { cause: error });
  }
}

export async function searchSimilarVectors(
  queryEmbedding: number[],
  topK: number,
  documentId: string
): Promise<Source[]> {
  try {
    const results = await getIndex().query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: { documentId: { $eq: documentId } },
    });

    return results.matches
      .filter((match) => match.metadata && match.score !== undefined)
      .map((match) => ({
        page: Number(match.metadata!.page),
        content: String(match.metadata!.content),
        score: match.score!,
      }));
  } catch (error) {
    throw new FriendlyError(`Failed to search vectors in Pinecone. ${keyHint}`, { cause: error });
  }
}

export async function deleteDocumentVectors(documentId: string): Promise<void> {
  try {
    await getIndex().deleteMany({ documentId });
  } catch (error) {
    throw new FriendlyError(`Failed to delete vectors from Pinecone. ${keyHint}`, { cause: error });
  }
}
