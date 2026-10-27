import { FriendlyError } from './errors';
import type { Chunk } from './types';

interface Page {
  page: number;
  text: string;
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export async function processDocument(file: File): Promise<{ pageCount: number; chunks: Chunk[] }> {
  const { pageCount, pages } = await processPDF(file);
  const chunks = await createChunks(pages);
  return { pageCount, chunks };
}

async function processPDF(file: File): Promise<{ pageCount: number; pages: Page[] }> {
  try {
    const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');
    const loader = new PDFLoader(new Blob([await file.arrayBuffer()], { type: 'application/pdf' }));
    const docs = await loader.load();

    const pages = docs.map((doc) => ({
      page: doc.metadata.loc.pageNumber as number,
      text: doc.pageContent.replace(/  +/g, ' ').trim(),
    }));

    return { pageCount: docs[0]?.metadata.pdf.totalPages ?? 0, pages };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('password')) {
      throw new FriendlyError('The PDF is password protected. Please upload an unprotected PDF.', { cause: error });
    }

    throw new FriendlyError('The uploaded file is not a valid PDF or is corrupted.', { cause: error });
  }
}

async function createChunks(pages: Page[]): Promise<Chunk[]> {
  const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 400,
    separators: ['\n\n\n', '\n\n', '\n', '. ', ' ', ''],
  });

  const chunks: Chunk[] = [];

  for (const { page, text } of pages) {
    if (!text) continue;

    for (const content of await splitter.splitText(text)) {
      chunks.push({ content, page });
    }
  }

  return chunks;
}
