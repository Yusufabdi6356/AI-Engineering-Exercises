import dotenv from 'dotenv';
import fs from 'fs';
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

const sarah = {
  speaker: 'sarah',
  voice: '933563129e564b19a115bedd57b7406a',
  instructions: 'Speak in a cheerful, excited tone, a little fast, like you cannot wait to share good news.'
};

const david = {
  speaker: 'david',
  voice: 'c5f56a6cc2ec4fa8920cb4c5889a3fb7',
  instructions: 'Speak in a calm, slow and thoughtful tone, with short pauses between sentences.'
};

const script = [
  { ...sarah, text: 'Guess what? I finally finished my first AI app this morning!' },
  { ...david, text: 'That is great news. What does it do, and how long did it take you?' },
  { ...sarah, text: 'It writes blog outlines and answers questions about them. It only took me two evenings!' },
  { ...david, text: 'Impressive. Take a short break first, then show me how it works.' }
];

if (!fs.existsSync('audio')) {
  fs.mkdirSync('audio');
}

for (const [index, line] of script.entries()) {
  const response = await openai.audio.speech.create({
    model: 'fish-audio/s2.1-pro',
    voice: line.voice,
    input: line.text,
    instructions: line.instructions,
    response_format: 'mp3'
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  const file = `audio/${String(index + 1).padStart(2, '0')}-${line.speaker}.mp3`;

  fs.writeFileSync(file, buffer);
  console.log(`Saved ${file}`);
}
