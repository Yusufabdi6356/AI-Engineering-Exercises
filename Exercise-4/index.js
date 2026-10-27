import path from 'path';
import { createText } from './text.js';
import { createImages } from './images.js';
import { createNarration } from './audio.js';
import { exportPackage } from './export.js';

const topic = process.argv.slice(2).join(' ').trim();

if (!topic) {
  console.log('Usage: node index.js "your topic"');
  process.exit(1);
}

try {
  console.log(`Writing the article, summary and social posts for "${topic}"...`);
  const text = await createText(topic);

  console.log('Creating the header and thumbnail...');
  const images = await createImages(topic);

  console.log('Recording the narration...');
  const narration = await createNarration(text.summary);

  const folder = exportPackage(topic, text, images, narration);
  console.log(`Done. Open ${path.join(folder, 'index.html')} to preview the content suite.`);
} catch (error) {
  console.error(`Could not create the content suite: ${error.message}`);
  process.exit(1);
}
