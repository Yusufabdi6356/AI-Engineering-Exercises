import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { getConversations } from '@/lib/chat-store';

export const dynamic = 'force-dynamic';

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const conversations = await getConversations();

  return (
    <SidebarProvider>
      <AppSidebar conversations={conversations} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
