import type { UIMessage } from 'ai';
import { connectToDatabase } from './db';
import { Conversation } from './models';

export async function saveConversation(chatId: string, messages: UIMessage[]) {
  try {
    await connectToDatabase();
    await Conversation.updateOne({ chatId }, { $set: { messages } }, { upsert: true });
  } catch (error) {
    console.error('[conversation]', error);
  }
}
