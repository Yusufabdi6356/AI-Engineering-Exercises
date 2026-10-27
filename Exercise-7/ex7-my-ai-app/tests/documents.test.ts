import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET } from '@/app/api/documents/route';
import { createDocument, getDocument } from '@/lib/mongodb';
import { closeTestDatabase, jsonRequest, setupTestDatabase } from './helpers';
import { pineconeIndex } from './mocks';

vi.mock('@pinecone-database/pinecone', async () => (await import('./mocks')).pineconeModule);
vi.mock('@/lib/ai/openrouter', async () => (await import('./mocks')).openrouterModule);

const sampleDocument = {
  documentId: 'doc-1',
  title: 'honeybees',
  filename: 'honeybees.pdf',
  fileSize: 2048,
  pageCount: 3,
  chunkCount: 3,
};

describe('/api/documents', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await closeTestDatabase();
  });

  it('returns an empty list when nothing is uploaded', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ success: true, documents: [] });
  });

  it('lists saved documents', async () => {
    await createDocument(sampleDocument);

    const { documents } = await (await GET()).json();

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject(sampleDocument);
    expect(typeof documents[0].uploadedAt).toBe('string');
  });

  it('deletes the document and its vectors', async () => {
    await createDocument(sampleDocument);

    const response = await DELETE(jsonRequest('http://localhost:3007/api/documents?documentId=doc-1', 'DELETE'));

    expect(response.status).toBe(200);
    expect(pineconeIndex.deleteMany).toHaveBeenCalledWith({ documentId: 'doc-1' });
    expect(await getDocument('doc-1')).toBeNull();
  });

  it('keeps the document when Pinecone cannot delete its vectors', async () => {
    await createDocument(sampleDocument);
    pineconeIndex.deleteMany.mockRejectedValueOnce(new Error('timeout'));

    const response = await DELETE(jsonRequest('http://localhost:3007/api/documents?documentId=doc-1', 'DELETE'));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain('Failed to delete vectors from Pinecone');
    expect(await getDocument('doc-1')).not.toBeNull();
  });

  it('returns 404 for an unknown document', async () => {
    const response = await DELETE(jsonRequest('http://localhost:3007/api/documents?documentId=nope', 'DELETE'));
    expect(response.status).toBe(404);
  });

  it('asks for the Pinecone key before deleting', async () => {
    vi.stubEnv('PINECONE_API_KEY', '');

    const response = await DELETE(jsonRequest('http://localhost:3007/api/documents?documentId=doc-1', 'DELETE'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Add PINECONE_API_KEY to .env.local to delete document vectors.',
    });
  });
});
