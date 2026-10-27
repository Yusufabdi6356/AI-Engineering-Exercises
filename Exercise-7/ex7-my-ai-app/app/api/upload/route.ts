import { NextRequest, NextResponse } from 'next/server';
import { isPdf, processDocument } from '@/lib/document-processor';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { deleteDocumentVectors, storeVectors } from '@/lib/pinecone';
import { createDocument } from '@/lib/mongodb';
import { missingKeys } from '@/lib/env';
import { friendlyMessage } from '@/lib/errors';
import { MAX_FILE_SIZE } from '@/lib/utils';
import type { Chunk } from '@/lib/types';

const MAX_CHUNKS = 500;
const tooLarge = 'File too large. Maximum size is 10MB.';

export async function POST(request: NextRequest) {
  const missing = missingKeys(['OPENROUTER_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX_NAME'], 'process documents');
  if (missing) {
    return NextResponse.json({ error: missing }, { status: 503 });
  }

  if (Number(request.headers.get('content-length')) > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: tooLarge }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a PDF file to upload.' }, { status: 400 });
  }

  if (!isPdf(file)) {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: tooLarge }, { status: 413 });
  }

  let pageCount: number;
  let chunks: Chunk[];

  try {
    ({ pageCount, chunks } = await processDocument(file));
  } catch (error) {
    return NextResponse.json({ error: friendlyMessage(error, 'Could not read this PDF.') }, { status: 400 });
  }

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: 'No text could be found in this PDF. Scanned or image-only PDFs are not supported.' },
      { status: 400 }
    );
  }

  if (chunks.length > MAX_CHUNKS) {
    return NextResponse.json(
      { error: 'This PDF is too long. Please upload one with up to about 300 pages of text.' },
      { status: 400 }
    );
  }

  let storedDocumentId: string | null = null;

  try {
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const title = file.name.replace(/\.[^/.]+$/, '');
    const embeddings = await generateEmbeddings(chunks.map((chunk) => chunk.content));

    storedDocumentId = documentId;
    await storeVectors(documentId, chunks, embeddings, { title, filename: file.name });

    await createDocument({
      documentId,
      title,
      filename: file.name,
      fileSize: file.size,
      pageCount,
      chunkCount: chunks.length,
    });

    return NextResponse.json({
      success: true,
      documentId,
      message: `Processed ${pageCount} pages into ${chunks.length} chunks.`,
    });
  } catch (error) {
    console.error('Upload failed:', error);

    if (storedDocumentId) {
      await deleteDocumentVectors(storedDocumentId).catch(() => undefined);
    }

    return NextResponse.json(
      { error: friendlyMessage(error, 'Could not process the PDF. Please try again.') },
      { status: 500 }
    );
  }
}
