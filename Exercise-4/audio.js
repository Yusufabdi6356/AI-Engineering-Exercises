import { openai, withFallback } from './client.js';

const voice = '933563129e564b19a115bedd57b7406a';
const instructions = 'Speak in a warm, friendly and upbeat tone, like a podcast host introducing a new episode.';

export const createNarration = async (text) => {
  const { model, result } = await withFallback(['fish-audio/s2.1-pro', 'fish-audio/s2-pro'], async (model) => {
    const response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      instructions,
      response_format: 'mp3'
    });

    return Buffer.from(await response.arrayBuffer());
  });

  return { model, voice, instructions, buffer: result };
};
