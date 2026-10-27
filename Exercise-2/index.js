import dotenv from 'dotenv';
import fs from 'fs';
import readline from 'readline/promises';
import OpenAI from 'openai';

dotenv.config({ quiet: true });

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Add your OPENROUTER_API_KEY to the .env file first.');
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

const models = {
  'openai/gpt-image-2.5-flare': [
    { name: 'square', aspect_ratio: '1:1' },
    { name: 'landscape', aspect_ratio: '3:2' },
    { name: 'portrait', aspect_ratio: '2:3' }
  ],
  'openai/gpt-image-2': [
    { name: 'square', aspect_ratio: '1:1' },
    { name: 'landscape', aspect_ratio: '16:9' },
    { name: 'portrait', aspect_ratio: '9:16' }
  ]
};

const styles = {
  vivid: 'vivid style, hyper-real and dramatic with bold saturated colors',
  natural: 'natural style, realistic with soft lighting and true-to-life colors'
};

const quality = 'low';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const theme = (await rl.question('Enter a theme (for example "cyberpunk cityscape"): ')).trim();
rl.close();

const slug = theme.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

if (!fs.existsSync('images')) {
  fs.mkdirSync('images');
}

const gallery = [];

for (const [model, sizes] of Object.entries(models)) {
  for (const size of sizes) {
    for (const [style, description] of Object.entries(styles)) {
      const prompt = `${theme}, ${description}`;
      const name = `${slug}_${model.split('/')[1]}_${size.name}_${style}`;

      console.log(`Generating ${name}...`);

      try {
        const result = await openai.images.generate({
          model,
          prompt,
          aspect_ratio: size.aspect_ratio,
          quality
        });

        const image = result.data[0];
        const bytes = Buffer.from(image.b64_json, 'base64');
        const file = `images/${name}.png`;

        fs.writeFileSync(file, bytes);

        const metadata = {
          theme,
          prompt,
          revised_prompt: image.revised_prompt || null,
          model,
          size: `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,
          aspect_ratio: size.aspect_ratio,
          style,
          quality,
          created_at: new Date().toISOString(),
          file
        };

        fs.writeFileSync(`images/${name}.json`, JSON.stringify(metadata, null, 2));
        gallery.push(metadata);
      } catch (error) {
        console.error(`Could not generate ${name}: ${error.message}`);
      }
    }
  }
}

const sections = Object.keys(models).map((model) => {
  const cards = gallery
    .filter((item) => item.model === model)
    .map((item) => `
      <figure>
        <img src="${item.file}" alt="${item.theme}">
        <figcaption>
          <strong>${item.size} (${item.aspect_ratio}), ${item.style}</strong><br>
          Quality: ${item.quality}<br>
          Prompt: ${item.prompt}<br>
          Created: ${item.created_at}
        </figcaption>
      </figure>`)
    .join('');

  return `<h2>${model}</h2>\n  <div class="grid">${cards}\n  </div>`;
}).join('\n  ');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${theme} gallery</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; background: #f4f4f4; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    figure { margin: 0; padding: 0.75rem; background: #fff; border-radius: 8px; }
    img { width: 100%; height: 280px; object-fit: contain; background: #222; }
    figcaption { margin-top: 0.5rem; font-size: 0.85rem; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>${theme}</h1>
  ${sections}
</body>
</html>
`;

fs.writeFileSync('gallery.html', html);

console.log(`Saved ${gallery.length} images. Open gallery.html to see them.`);
