import { openai, withFallback } from './client.js';

const models = ['openai/gpt-4', 'openai/gpt-4o-mini'];

const ask = (prompt, maxTokens) =>
  withFallback(models, async (model) => {
    const response = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content.trim();
  });

const removeCodeFence = (text) => text.replace(/^```(?:markdown)?\s*\n/i, '').replace(/\n```$/, '');

export const createText = async (topic) => {
  const article = await ask(
    `Write a blog article of about 500 words about: ${topic}. Start with a title, then use a few short sections. Format it in Markdown.`,
    1000
  );

  const articleText = removeCodeFence(article.result);

  const summary = await ask(`Summarize this article in exactly 2 sentences:\n\n${articleText}`, 150);

  const x = await ask(
    `Write a post for X (under 280 characters, at most 2 hashtags) that promotes this article:\n\n${summary.result}`,
    120
  );

  const linkedin = await ask(
    `Write a LinkedIn post of 80 to 150 words that promotes this article in a professional tone:\n\n${summary.result}`,
    300
  );

  return {
    article: articleText,
    summary: summary.result,
    social: { x: x.result, linkedin: linkedin.result },
    model: article.model
  };
};
