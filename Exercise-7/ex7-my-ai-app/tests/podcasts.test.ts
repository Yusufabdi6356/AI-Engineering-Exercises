import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/podcasts/route';
import { GET as GET_ONE } from '@/app/api/podcasts/[podcastId]/route';
import { createDocument, getPodcast, Podcast } from '@/lib/mongodb';
import { closeTestDatabase, jsonRequest, readChunks, routeParams, setupTestDatabase } from './helpers';
import { cohereRerank, embed, pineconeIndex, scriptStream, streamScript } from './mocks';

vi.mock('@pinecone-database/pinecone', async () => (await import('./mocks')).pineconeModule);
vi.mock('cohere-ai', async () => (await import('./mocks')).cohereModule);
vi.mock('@/lib/ai/openrouter', async () => (await import('./mocks')).openrouterModule);

const matches = [
  { id: 'doc-1-chunk-0', score: 0.82, metadata: { documentId: 'doc-1', page: 1, content: 'Scouts search for a new home.' } },
  { id: 'doc-1-chunk-1', score: 0.8, metadata: { documentId: 'doc-1', page: 2, content: 'Scouts perform a waggle dance.' } },
  { id: 'doc-1-chunk-2', score: 0.78, metadata: { documentId: 'doc-1', page: 3, content: 'Fifteen bees make a quorum.' } },
];

function generate(documentId = 'doc-1') {
  return POST(jsonRequest('http://localhost:3007/api/podcasts', 'POST', { documentId }));
}

describe('/api/podcasts', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    await createDocument({
      documentId: 'doc-1',
      title: 'honeybees',
      filename: 'honeybees.pdf',
      fileSize: 2048,
      pageCount: 3,
      chunkCount: 3,
    });
    pineconeIndex.query.mockResolvedValue({ matches });
    cohereRerank.mockResolvedValue({
      results: [
        { index: 1, relevanceScore: 0.97 },
        { index: 2, relevanceScore: 0.91 },
        { index: 0, relevanceScore: 0.55 },
      ],
    });
    streamScript.mockImplementation(async () =>
      scriptStream(['Welcome to the show about honeybees [p. 1]. ', 'Scouts dance to vote [p. 2]. ', 'Thanks for listening.'])
    );
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await closeTestDatabase();
  });

  it('asks for the missing keys before doing any work', async () => {
    vi.stubEnv('PINECONE_API_KEY', '');
    vi.stubEnv('COHERE_API_KEY', '');

    const response = await generate();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Add PINECONE_API_KEY and COHERE_API_KEY to .env.local to write podcast scripts.',
    });
    expect(embed).not.toHaveBeenCalled();
    expect(streamScript).not.toHaveBeenCalled();
  });

  it('retrieves, reranks, streams the script and saves the episode with page sources', async () => {
    const response = await generate();
    const podcastId = response.headers.get('X-Podcast-Id')!;
    const chunks = await readChunks(response);

    expect(response.status).toBe(200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(
      'Welcome to the show about honeybees [p. 1]. Scouts dance to vote [p. 2]. Thanks for listening.'
    );

    expect(pineconeIndex.query).toHaveBeenCalledWith({
      vector: expect.any(Array),
      topK: 20,
      includeMetadata: true,
      filter: { documentId: { $eq: 'doc-1' } },
    });
    expect(cohereRerank).toHaveBeenCalledWith({
      model: 'rerank-v3.5',
      query: 'What are the main ideas, key facts and conclusions of honeybees?',
      documents: matches.map((match) => match.metadata.content),
      topN: 8,
    });

    const prompt = JSON.stringify(streamScript.mock.calls[0][0].prompt);
    expect(prompt).toContain('[Source 1, page 2]');
    expect(prompt).toContain('Scouts perform a waggle dance.');

    const saved = await getPodcast(podcastId);
    expect(saved).toMatchObject({
      documentId: 'doc-1',
      documentTitle: 'honeybees',
      hasAudio: false,
      script: 'Welcome to the show about honeybees [p. 1]. Scouts dance to vote [p. 2]. Thanks for listening.',
    });
    expect(saved!.sources.map((source) => [source.page, source.score])).toEqual([
      [2, 0.97],
      [3, 0.91],
      [1, 0.55],
    ]);

    const list = await (await GET()).json();
    expect(list.podcasts.map((podcast: { podcastId: string }) => podcast.podcastId)).toEqual([podcastId]);
  });

  it('keeps the Pinecone order when Cohere fails', async () => {
    cohereRerank.mockRejectedValueOnce(new Error('Cohere is down'));

    const response = await generate();
    const podcastId = response.headers.get('X-Podcast-Id')!;
    await readChunks(response);

    const saved = await getPodcast(podcastId);
    expect(saved!.sources.map((source) => source.page)).toEqual([1, 2, 3]);
  });

  it('saves nothing when the model fails', async () => {
    streamScript.mockImplementation(async () => scriptStream(['Welcome to'], 'error'));

    const response = await generate();
    const podcastId = response.headers.get('X-Podcast-Id')!;
    await readChunks(response);

    expect(await Podcast.countDocuments()).toBe(0);
    const lookup = await GET_ONE(jsonRequest(`http://localhost:3007/api/podcasts/${podcastId}`, 'GET'), routeParams(podcastId));
    expect(lookup.status).toBe(404);
  });

  it('explains when Pinecone has no content for the document', async () => {
    pineconeIndex.query.mockResolvedValue({ matches: [] });

    const response = await generate();

    expect(response.status).toBe(404);
    expect((await response.json()).error).toContain('No content was found for this document in Pinecone');
    expect(streamScript).not.toHaveBeenCalled();
  });

  it('shows a friendly message when Pinecone search fails', async () => {
    pineconeIndex.query.mockRejectedValueOnce(new Error('ECONNRESET'));

    const response = await generate();

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe(
      'Failed to search vectors in Pinecone. Check PINECONE_API_KEY and that the index exists with 1536 dimensions.'
    );
  });

  it('caps the output tokens of the script call', async () => {
    await readChunks(await generate());
    expect(streamScript.mock.calls[0][0].maxOutputTokens).toBe(4000);
  });

  it('does not save a script that was cut off by the token limit', async () => {
    streamScript.mockImplementation(async () => scriptStream(['Welcome to the show'], 'length'));

    await readChunks(await generate());

    expect(await Podcast.countDocuments()).toBe(0);
  });

  it('rejects a document ID that is not a string', async () => {
    const response = await POST(
      jsonRequest('http://localhost:3007/api/podcasts', 'POST', { documentId: { $ne: null } })
    );

    expect(response.status).toBe(400);
    expect(embed).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown document', async () => {
    const response = await generate('missing');
    expect(response.status).toBe(404);
  });
});
