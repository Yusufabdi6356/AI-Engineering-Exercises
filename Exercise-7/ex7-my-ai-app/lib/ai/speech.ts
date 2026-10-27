import OpenAI from 'openai';

export async function createSpeech(text: string): Promise<Buffer> {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const response = await client.audio.speech.create({
    model: 'fish-audio/s2.1-pro',
    voice: '933563129e564b19a115bedd57b7406a',
    input: text,
    instructions: 'Speak like a warm, engaging podcast host.',
    response_format: 'mp3',
  });

  return Buffer.from(await response.arrayBuffer());
}
