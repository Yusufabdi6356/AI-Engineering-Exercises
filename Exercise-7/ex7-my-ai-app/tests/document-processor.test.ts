import { describe, expect, it } from 'vitest';
import { processDocument } from '@/lib/document-processor';
import { buildPdf, buildSamplePdf } from './sample-pdf';

function pdfFile(bytes: Uint8Array, name = 'sample.pdf') {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}

describe('processDocument', () => {
  it('reads every page and keeps the page number on each chunk', async () => {
    const { pageCount, chunks } = await processDocument(pdfFile(await buildSamplePdf()));

    expect(pageCount).toBe(3);
    expect(chunks.map((chunk) => chunk.page)).toEqual([1, 2, 3]);
    expect(chunks[1].content).toContain('The Waggle Dance Debate');
  });

  it('keeps the real page number when a page has no text', async () => {
    const bytes = await buildPdf([['First page text.'], [], ['Third page text.']]);
    const { pageCount, chunks } = await processDocument(pdfFile(bytes));

    expect(pageCount).toBe(3);
    expect(chunks).toEqual([
      { content: 'First page text.', page: 1 },
      { content: 'Third page text.', page: 3 },
    ]);
  });

  it('splits long pages into 2,000 character chunks with overlap', async () => {
    const sentence = 'Scouts compare cavities by size, entrance and height before they dance.';
    const paragraphs = Array.from({ length: 10 }, (_, i) => `${i + 1}. ${sentence} ${sentence} ${sentence}`);
    const { chunks } = await processDocument(pdfFile(await buildPdf([paragraphs])));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 2000 && chunk.page === 1)).toBe(true);
    const lastLineOfFirst = chunks[0].content.split('\n').at(-1)!;
    expect(chunks[1].content).toContain(lastLineOfFirst);
  });

  it('gives a friendly error for a file that is not a PDF', async () => {
    const file = new File(['just some text'], 'notes.pdf', { type: 'application/pdf' });
    await expect(processDocument(file)).rejects.toThrow('The uploaded file is not a valid PDF or is corrupted.');
  });
});
