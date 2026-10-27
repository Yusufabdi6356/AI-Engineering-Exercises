import { loadChat } from '@/lib/chat-store';
import Chat from '@/components/chat';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params;
  const initialMessages = await loadChat(id);

  return <Chat conversationId={id} initialMessages={initialMessages} />;
}
