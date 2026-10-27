import dotenv from 'dotenv';
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

const model = 'openai/gpt-4';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const streamOutline = async (topic, temperature) => {
  const stream = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: 1000,
    stream: true,
    messages: [
      {
        role: 'system',
        content: 'You are a blog writer. Write a blog post outline with a title, main sections and short bullet points.'
      },
      { role: 'user', content: `Write a blog post outline about: ${topic}` }
    ]
  });

  let outline = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
    outline += content;
  }

  return outline;
};

const summarizeOutline = async (outline, temperature) => {
  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: 150,
    messages: [
      { role: 'user', content: `Summarize this blog post outline in exactly 2 sentences:\n\n${outline}` }
    ]
  });

  return response.choices[0].message.content;
};

const answerQuestion = async (topic, outline, question, temperature) => {
  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: 'You answer follow-up questions about a blog post. Use the topic and the outline as context.'
      },
      { role: 'user', content: `Topic: ${topic}\n\nOutline:\n${outline}\n\nQuestion: ${question}` }
    ]
  });

  return response.choices[0].message.content;
};

try {
  const topic = await rl.question('What topic do you want to write about? ');
  const mode = await rl.question('Creative or factual? ');
  const creative = mode.trim().toLowerCase().startsWith('c');
  const temperature = creative ? 0.9 : 0.2;

  console.log(`\n${creative ? 'Creative' : 'Factual'} outline:\n`);
  const outline = await streamOutline(topic, temperature);

  console.log('\n\nSummary:');
  console.log(await summarizeOutline(outline, temperature));

  while (true) {
    const question = (await rl.question('\nAsk a follow-up question (or type exit): ')).trim();

    if (question.toLowerCase() === 'exit') break;
    if (!question) continue;

    console.log(`\n${await answerQuestion(topic, outline, question, temperature)}`);
  }
} catch (error) {
  console.error(`\nSomething went wrong: ${error.message}`);
} finally {
  rl.close();
}
