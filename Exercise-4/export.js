import fs from 'fs';
import path from 'path';

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const exportPackage = (topic, text, images, narration) => {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const folder = path.join('output', slug);

  fs.mkdirSync(folder, { recursive: true });

  fs.writeFileSync(path.join(folder, 'article.md'), text.article);
  fs.writeFileSync(path.join(folder, 'summary.txt'), text.summary);
  fs.writeFileSync(path.join(folder, 'social.json'), JSON.stringify(text.social, null, 2));
  fs.writeFileSync(path.join(folder, 'header.png'), images.header.result);
  fs.writeFileSync(path.join(folder, 'thumbnail.png'), images.thumbnail.result);
  fs.writeFileSync(path.join(folder, 'narration.mp3'), narration.buffer);

  const manifest = {
    topic,
    created_at: new Date().toISOString(),
    files: ['article.md', 'summary.txt', 'social.json', 'header.png', 'thumbnail.png', 'narration.mp3', 'index.html'],
    models: {
      text: text.model,
      header: images.header.model,
      thumbnail: images.thumbnail.model,
      narration: narration.model
    },
    narration: {
      voice: narration.voice,
      instructions: narration.instructions
    }
  };

  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(topic)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    img { max-width: 100%; border-radius: 8px; }
    .thumbnail { width: 200px; }
    .article { white-space: pre-wrap; }
    .post { background: #f4f4f4; padding: 1rem; border-radius: 8px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <img src="header.png" alt="Header">
  <h2>Summary</h2>
  <p>${escape(text.summary)}</p>
  <audio controls src="narration.mp3"></audio>
  <h2>Article</h2>
  <div class="article">${escape(text.article)}</div>
  <h2>Social posts</h2>
  <h3>X</h3>
  <div class="post">${escape(text.social.x)}</div>
  <h3>LinkedIn</h3>
  <div class="post">${escape(text.social.linkedin)}</div>
  <h2>Thumbnail</h2>
  <img class="thumbnail" src="thumbnail.png" alt="Thumbnail">
</body>
</html>
`;

  fs.writeFileSync(path.join(folder, 'index.html'), html);

  return folder;
};
