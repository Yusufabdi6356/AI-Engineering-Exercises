import { openai, withFallback } from './client.js';

export const generateImage = (models, prompt, aspect_ratio) =>
  withFallback(models, async (model) => {
    const result = await openai.images.generate({ model, prompt, aspect_ratio, quality: 'low' });
    return Buffer.from(result.data[0].b64_json, 'base64');
  });

export const createImages = async (topic) => {
  const header = await generateImage(
    ['openai/gpt-image-2', 'openai/gpt-image-2.5-flare'],
    `A wide blog header image for an article about ${topic}. No text in the image.`,
    '16:9'
  );

  const thumbnail = await generateImage(
    ['openai/gpt-image-2.5-flare', 'openai/gpt-image-2'],
    `A simple square thumbnail for an article about ${topic}. No text in the image.`,
    '1:1'
  );

  return { header, thumbnail };
};
