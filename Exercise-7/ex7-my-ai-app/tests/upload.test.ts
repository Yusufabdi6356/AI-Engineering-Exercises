import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/upload/route';
import { Document } from '@/lib/mongodb';
import { closeTestDatabase, setupTestDatabase, uploadRequest } from './helpers';
import { embed, pineconeIndex } from './mocks';
import { buildSamplePdf } from './sample-pdf';

vi.mock('@pinecone-database/pinecone', async () => (await import('./mocks')).pineconeModule);
vi.mock('@/lib/ai/openrouter', async () => (await import('./mocks')).openrouterModule);

describe('POST /api/upload', () => {
  let samplePdf: Uint8Array;

  beforeAll(async () => {
    samplePdf = await buildSamplePdf();
  });

  beforeEach(async () => {
    await setupTestDatabase();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await closeTestDatabase();
  });

  it('asks for the Pinecone key and saves nothing when it is missing', async () => {
    vi.stubEnv('PINECONE_API_KEY', '');

    const response = await POST(uploadRequest(samplePdf));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Add PINECONE_API_KEY to .env.local to process documents.',
    });
    expect(await Document.countDocuments()).toBe(0);
    expect(embed).not.toHaveBeenCalled();
    expect(pineconeIndex.upsert).not.toHaveBeenCalled();
  });

  it('chunks, embeds, stores vectors with page numbers and saves the document', async () => {
    const response = await POST(uploadRequest(samplePdf));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Processed 3 pages into 3 chunks.');

    const vectors = pineconeIndex.upsert.mock.calls[0][0];
    expect(vectors).toHaveLength(3);
    expect(vectors[0].id).toBe(`${body.documentId}-chunk-0`);
    expect(vectors[0].values).toHaveLength(1536);
    expect(vectors[2].metadata).toMatchObject({
      documentId: body.documentId,
      chunkIndex: 2,
      page: 3,
      title: 'honeybees',
      filename: 'honeybees.pdf',
    });

    const saved = await Document.findOne({ documentId: body.documentId }).lean();
    expect(saved).toMatchObject({ title: 'honeybees', pageCount: 3, chunkCount: 3 });
  });

  it('rejects files that are not PDFs', async () => {
    const response = await POST(uploadRequest(new TextEncoder().encode('hello'), 'notes.txt', 'text/plain'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Only PDF files are supported.' });
  });

  it('cleans up and saves no document when Pinecone fails', async () => {
    pineconeIndex.upsert.mockRejectedValueOnce(new Error('401 Unauthorized'));

    const response = await POST(uploadRequest(samplePdf));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe(
      'Failed to store vectors in Pinecone. Check PINECONE_API_KEY and that the index exists with 1536 dimensions.'
    );
    expect(pineconeIndex.deleteMany).toHaveBeenCalledTimes(1);
    expect(await Document.countDocuments()).toBe(0);
  });

  it('rejects a body over 10MB before reading it', async () => {
    const request = uploadRequest(samplePdf);
    request.headers.set('content-length', String(11 * 1024 * 1024));

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'File too large. Maximum size is 10MB.' });
    expect(embed).not.toHaveBeenCalled();
  });

  it('rejects a PDF over 10MB', async () => {
    const response = await POST(uploadRequest(new Uint8Array(10 * 1024 * 1024 + 1)));

    expect(response.status).toBe(413);
    expect(embed).not.toHaveBeenCalled();
  });

  it('answers 400 for a corrupt PDF without calling any paid service', async () => {
    const response = await POST(uploadRequest(new TextEncoder().encode('not really a pdf'), 'broken.pdf'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'The uploaded file is not a valid PDF or is corrupted.' });
    expect(embed).not.toHaveBeenCalled();
  });

  it('asks for a file when the form has none', async () => {
    const response = await POST(new NextRequest('http://localhost:3007/api/upload', { method: 'POST', body: 'hello' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Choose a PDF file to upload.' });
  });

  it('asks for the OpenRouter key instead of falling back to OPENAI_API_KEY', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'sk-should-never-be-used');

    const response = await POST(uploadRequest(samplePdf));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Add OPENROUTER_API_KEY to .env.local to process documents.' });
    expect(embed).not.toHaveBeenCalled();
  });

  it('never sends raw database errors to the browser', async () => {
    vi.spyOn(Document, 'create').mockRejectedValueOnce(new Error('E11000 duplicate key mongodb://127.0.0.1'));

    const response = await POST(uploadRequest(samplePdf));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Could not process the PDF. Please try again.' });
    expect(pineconeIndex.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('saves nothing when embeddings fail', async () => {
    embed.mockRejectedValueOnce(new Error('Insufficient credits'));

    const response = await POST(uploadRequest(samplePdf));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe(
      'Could not create embeddings. Check OPENROUTER_API_KEY and your OpenRouter credit.'
    );
    expect(pineconeIndex.upsert).not.toHaveBeenCalled();
    expect(await Document.countDocuments()).toBe(0);
  });
});
