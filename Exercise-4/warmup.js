import fs from 'fs';
import path from 'path';
import { openai } from './client.js';

const file = process.argv[2];

if (!file || !fs.existsSync(file)) {
  console.log('Usage: node warmup.js path/to/recording.m4a');
  process.exit(1);
}

const models = ['openai/gpt-4o-transcribe', 'openai/gpt-4o-mini-transcribe'];
const name = path.parse(file).name;
const transcripts = {};

fs.mkdirSync('warmup', { recursive: true });

for (const model of models) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(file),
    model
  });

  transcripts[model] = transcription.text;
  fs.writeFileSync(path.join('warmup', `${name}.${model.split('/')[1]}.txt`), transcription.text);
  console.log(`\n${model}:\n${transcription.text}`);
}

const words = (text) => new Set(text.toLowerCase().match(/[a-z0-9']+/g) || []);
const [full, mini] = models.map((model) => words(transcripts[model]));
const onlyFull = [...full].filter((word) => !mini.has(word));
const onlyMini = [...mini].filter((word) => !full.has(word));

const report = `# Transcription comparison: ${name}

## gpt-4o-transcribe
${transcripts[models[0]]}

## gpt-4o-mini-transcribe
${transcripts[models[1]]}

## Differences
Words only in gpt-4o-transcribe: ${onlyFull.join(', ') || 'none'}
Words only in gpt-4o-mini-transcribe: ${onlyMini.join(', ') || 'none'}
`;

fs.writeFileSync(path.join('warmup', `${name}.comparison.md`), report);

console.log(`\nWords only in gpt-4o-transcribe: ${onlyFull.join(', ') || 'none'}`);
console.log(`Words only in gpt-4o-mini-transcribe: ${onlyMini.join(', ') || 'none'}`);
console.log(`\nSaved both transcripts and the comparison in the warmup folder.`);
