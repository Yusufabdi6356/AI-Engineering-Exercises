import { UIMessage } from 'ai';
import { connectDB } from '@/lib/mongodb';
import { Conversation } from '@/models/conversation';
import { Message, type Feedback } from '@/models/message';

export type { Feedback };

export type ChatMessage = UIMessage<{ model?: string; feedback?: Feedback | null }>;

export async function getConversations() {
  await connectDB();
  const conversations = await Conversation.find().sort({ updatedAt: -1 }).lean();

  return conversations.map(conv => ({ id: conv._id, title: conv.title }));
}

export async function loadChat(conversationId: string): Promise<ChatMessage[]> {
  await connectDB();
  const messages = await Message.find({ conversationId }).sort({ position: 1 }).lean();

  return messages.map(msg => ({
    id: msg._id,
    role: msg.role,
    parts: [{ type: 'text' as const, text: msg.content }],
    metadata: { model: msg.model, feedback: msg.feedback },
  }));
}

export async function saveChat({ chatId, messages }: { chatId: string; messages: ChatMessage[] }): Promise<void> {
  await connectDB();

  const ids = messages.map(msg => msg.id);
  await Message.deleteMany({ conversationId: chatId, _id: { $nin: ids } });

  const existingIds = new Set(await Message.find({ conversationId: chatId }).distinct('_id'));
  const newMessages = messages
    .map((msg, position) => ({
      _id: msg.id,
      conversationId: chatId,
      role: msg.role,
      content: msg.parts.find(part => part.type === 'text')?.text || '',
      position,
      model: msg.metadata?.model,
    }))
    .filter(msg => !existingIds.has(msg._id));

  await Message.insertMany(newMessages);
  await Conversation.updateOne({ _id: chatId }, { updatedAt: new Date() }, { upsert: true });
}

export async function renameConversation(id: string, title: string) {
  await connectDB();
  await Conversation.updateOne({ _id: id }, { title }, { timestamps: false });
}

export async function deleteConversation(id: string) {
  await connectDB();
  await Message.deleteMany({ conversationId: id });
  await Conversation.deleteOne({ _id: id });
}

export async function setFeedback(messageId: string, feedback: Feedback | null) {
  await connectDB();
  await Message.updateOne({ _id: messageId, role: 'assistant' }, { feedback }, { runValidators: true });
}
