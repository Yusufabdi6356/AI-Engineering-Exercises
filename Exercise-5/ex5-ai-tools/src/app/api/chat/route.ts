import { createOpenAI } from '@ai-sdk/openai';
import {
  APICallError,
  InvalidToolInputError,
  RetryError,
  streamText,
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
} from 'ai';
import { z } from 'zod';
import { saveConversation } from '@/lib/conversations';
import { FriendlyError } from '@/lib/errors';
import { isRateLimited } from '@/lib/rate-limit';
import { tools, type ChatMessage } from '@/tools';

export const maxDuration = 30;

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const system =
  'You are a friendly assistant for a small movie app. ' +
  'Use queryDatabase for questions about the local movies, users and reviews, ' +
  'searchMovie for details about a specific film, and getJokes when the user wants a joke or jokes about a topic. ' +
  'The user already sees every tool result as a table or card, so never list the rows and never retell the jokes. ' +
  'Reply in one or two short sentences that sum up the result, and mention when there are more pages. ' +
  'If a tool returns an error, explain it simply and suggest what to try next.';

const requestSchema = z.object({
  id: z.string().min(1).max(100),
  messages: z.array(z.unknown()).min(1).max(50),
});

const INVALID_REQUEST = 'The chat request was not valid. Please clear the chat and try again.';
const MAX_BODY_LENGTH = 100_000;

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function chatErrorMessage(error: unknown) {
  if (error instanceof FriendlyError) return error.message;

  console.error('[chat]', error);
  if (APICallError.isInstance(error) || RetryError.isInstance(error)) {
    return 'The AI model could not be reached. Check OPENROUTER_API_KEY and your OpenRouter credits, then try again.';
  }
  if (InvalidToolInputError.isInstance(error)) {
    return 'The assistant sent a tool request that did not pass validation. Try rephrasing your question.';
  }
  return 'Something went wrong. Please try again.';
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response('The server has no OPENROUTER_API_KEY. Add it to .env.local and restart the app.', {
      status: 500,
    });
  }

  if (isRateLimited()) {
    return new Response('Too many requests. Please wait a minute and try again.', { status: 429 });
  }

  const text = await req.text();
  if (text.length > MAX_BODY_LENGTH) {
    return new Response('This conversation is too long. Please clear the chat and start again.', { status: 413 });
  }

  const body = requestSchema.safeParse(parseJson(text));
  if (!body.success) return new Response(INVALID_REQUEST, { status: 400 });

  const validation = await safeValidateUIMessages<ChatMessage>({ messages: body.data.messages, tools });
  if (!validation.success || validation.data.some(message => message.role === 'system')) {
    return new Response(INVALID_REQUEST, { status: 400 });
  }

  const { id } = body.data;
  const messages = validation.data;
  const tooLong = messages.some(message => message.parts.some(part => part.type === 'text' && part.text.length > 4000));
  if (tooLong) return new Response('Messages can be at most 4000 characters long.', { status: 400 });

  const result = streamText({
    model: openrouter.chat('openai/gpt-4o'),
    system,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    maxOutputTokens: 500,
    tools,
    onFinish: ({ steps, totalUsage }) => {
      console.log(
        `[chat] ${steps.length} steps, ${totalUsage.inputTokens} input tokens, ${totalUsage.outputTokens} output tokens`,
      );
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: ({ messages }) => saveConversation(id, messages),
    onError: chatErrorMessage,
  });
}
