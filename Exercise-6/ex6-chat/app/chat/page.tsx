import { redirect } from 'next/navigation';
import { nanoid } from 'nanoid';

export default function NewChatPage() {
  redirect(`/chat/${nanoid()}`);
}
