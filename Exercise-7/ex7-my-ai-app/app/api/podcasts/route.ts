import { NextResponse } from 'next/server';
import { createPodcast, getAllPodcasts, getDocument } from '@/lib/mongodb';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { searchSimilarVectors } from '@/lib/pinecone';
import { rerankWithCohere } from '@/lib/ai/rerank';
import { streamPodcastScript } from '@/lib/ai/script';
import { missingKeys } from '@/lib/env';
import { friendlyMessage } from '@/lib/errors';
import type { Source } from '@/lib/types';

export const maxDuration = 60;

export async function GET() {
  try {
    const podcasts = await getAllPodcasts();
    return NextResponse.json({ success: true, podcasts });
  } catch (error) {
    console.error('Loading episodes failed:', error);
    return NextResponse.json(
      { error: 'Could not load your episodes. Check that MongoDB is running.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const missing = missingKeys(
    ['OPENROUTER_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX_NAME', 'COHERE_API_KEY'],
    'write podcast scripts'
  );
  if (missing) {
    return NextResponse.json({ error: missing }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const documentId = body?.documentId;

  if (typeof documentId !== 'string' || documentId.length > 100) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
  }

  let documentTitle: string;
  let sources: Source[];

  try {
    const document = await getDocument(documentId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    documentTitle = document.title;
    const query = `What are the main ideas, key facts and conclusions of ${documentTitle}?`;
    const results = await searchSimilarVectors(await generateEmbedding(query), 20, documentId);
    sources = await rerankWithCohere(query, results, 8);
  } catch (error) {
    console.error('Finding sources failed:', error);
    return NextResponse.json(
      { error: friendlyMessage(error, 'Could not find sources for this document. Please try again.') },
      { status: 500 }
    );
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: 'No content was found for this document in Pinecone. Try deleting it and uploading it again.' },
      { status: 404 }
    );
  }

  const podcastId = `podcast-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const result = streamPodcastScript({
    title: documentTitle,
    sources,
    onFinish: async (script) => {
      await createPodcast({ podcastId, documentId, documentTitle, script, sources }).catch((error) =>
        console.error('Saving the episode failed:', error)
      );
    },
  });

  return result.toTextStreamResponse({ headers: { 'X-Podcast-Id': podcastId } });
}
