import { writeFile } from 'fs/promises';
import { buildSamplePdf } from '../tests/sample-pdf';

async function main() {
  await writeFile('sample.pdf', await buildSamplePdf());
  console.log('Saved sample.pdf');
}

main();
