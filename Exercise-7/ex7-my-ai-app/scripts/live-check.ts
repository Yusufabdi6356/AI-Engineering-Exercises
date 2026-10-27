import { processDocument } from '../lib/document-processor';
import { generateEmbeddings } from '../lib/ai/embeddings';
import { streamPodcastScript } from '../lib/ai/script';
import { buildSamplePdf } from '../tests/sample-pdf';

async function main() {
  const file = new File([new Uint8Array(await buildSamplePdf())], 'honeybees.pdf', { type: 'application/pdf' });
  const { pageCount, chunks } = await processDocument(file);
  console.log(`Read ${pageCount} pages into ${chunks.length} chunks`);

  const embeddings = await generateEmbeddings(chunks.map((chunk) => chunk.content));
  console.log(`Embedded ${embeddings.length} chunks with ${embeddings[0].length} dimensions each`);

  const sources = chunks.map((chunk) => ({ ...chunk, score: 1 }));
  const result = streamPodcastScript({ title: 'honeybees', sources });

  let parts = 0;
  for await (const text of result.textStream) {
    parts++;
    process.stdout.write(text);
  }

  console.log(`\n\nStreamed ${parts} parts, finish reason ${await result.finishReason}`);
  console.log('Usage:', JSON.stringify(await result.totalUsage));
}

main();
