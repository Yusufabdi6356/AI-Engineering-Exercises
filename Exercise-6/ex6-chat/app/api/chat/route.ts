import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, createIdGenerator } from 'ai';
import { z } from 'zod';
import { loadChat, saveChat, type ChatMessage } from '@/lib/chat-store';
import { chatModels } from '@/lib/chat-models';

export const maxDuration = 30;

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const chatFields = {
  id: z.string().min(1).max(64),
  model: z.string().refine(model => chatModels.some(chatModel => chatModel.id === model)),
};

const requestSchema = z.discriminatedUnion('trigger', [
  z.object({
    ...chatFields,
    trigger: z.literal('submit-message'),
    message: z.object({
      id: z.string().min(1).max(64),
      role: z.literal('user'),
      parts: z.tuple([z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(4000) })]),
    }),
  }),
  z.object({
    ...chatFields,
    trigger: z.literal('regenerate-message'),
    messageId: z.string(),
  }),
]);

function parseBody(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set');
    return new Response('The server is missing its API key', { status: 500 });
  }

  try {
    const body = await req.text();
    if (body.length > 20000) {
      return new Response('Request too large', { status: 413 });
    }

    const request = requestSchema.safeParse(parseBody(body));
    if (!request.success) {
      return new Response('Invalid request', { status: 400 });
    }

    const { id: conversationId, model } = request.data;
    const previousMessages = await loadChat(conversationId);
    let messages: ChatMessage[];

    if (request.data.trigger === 'submit-message') {
      messages = [...previousMessages, request.data.message];
    } else {
      const { messageId } = request.data;
      const index = previousMessages.findIndex(msg => msg.id === messageId && msg.role === 'assistant');
      if (index === -1) {
        return new Response('Message not found', { status: 404 });
      }
      messages = previousMessages.slice(0, index);
    }

    const result = streamText({
      model: openrouter.chat(model),
      system: 'You are a helpful AI assistant. Be concise and helpful in your responses.',
      messages: convertToModelMessages(messages),
      maxOutputTokens: 1000,
    });

    result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: createIdGenerator({
        prefix: 'msg',
        size: 16,
      }),
      messageMetadata: ({ part }) => (part.type === 'start' ? { model } : undefined),
      onFinish: async ({ messages, outcome }) => {
        if (outcome.status === 'failed') {
          return;
        }

        try {
          await saveChat({ chatId: conversationId, messages });
        } catch (error) {
          console.error('Error saving messages:', error);
        }
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
