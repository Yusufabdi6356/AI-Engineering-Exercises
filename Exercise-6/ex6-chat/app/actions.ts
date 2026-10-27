'use server';

import { revalidatePath } from 'next/cache';
import { deleteConversation, renameConversation, setFeedback, type Feedback } from '@/lib/chat-store';

export async function renameChat(id: string, title: string) {
  const newTitle = title.trim().slice(0, 100);
  if (!newTitle) {
    return;
  }

  await renameConversation(id, newTitle);
  revalidatePath('/chat', 'layout');
}

export async function deleteChat(id: string) {
  await deleteConversation(id);
  revalidatePath('/chat', 'layout');
}

export async function rateMessage(messageId: string, feedback: Feedback | null) {
  await setFeedback(messageId, feedback);
}
