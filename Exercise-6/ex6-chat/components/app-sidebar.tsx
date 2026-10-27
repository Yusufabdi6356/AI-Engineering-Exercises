'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal, Pencil, SquarePen, Trash2 } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteChat, renameChat } from '@/app/actions';

interface Conversation {
  id: string;
  title: string;
}

export default function AppSidebar({ conversations }: { conversations: Conversation[] }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  const startRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setTitle(conversation.title);
  };

  const saveRename = async (conversation: Conversation) => {
    setEditingId(null);
    if (title.trim() !== conversation.title) {
      await renameChat(conversation.id, title);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }
    await deleteChat(deleting.id);
    if (deleting.id === params.id) {
      setOpenMobile(false);
      router.push('/chat');
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/chat" prefetch={false} onClick={() => setOpenMobile(false)}>
                <SquarePen />
                <span>New chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.map(conversation => (
                <SidebarMenuItem key={conversation.id}>
                  {editingId === conversation.id ? (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        saveRename(conversation);
                      }}
                    >
                      <SidebarInput
                        autoFocus
                        value={title}
                        aria-label="Chat title"
                        onChange={e => setTitle(e.target.value)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={e => e.key === 'Escape' && setEditingId(null)}
                      />
                    </form>
                  ) : (
                    <>
                      <SidebarMenuButton asChild isActive={conversation.id === params.id}>
                        <Link href={`/chat/${conversation.id}`} onClick={() => setOpenMobile(false)}>
                          <span>{conversation.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover>
                            <MoreHorizontal />
                            <span className="sr-only">Chat options</span>
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="start" onCloseAutoFocus={e => e.preventDefault()}>
                          <DropdownMenuItem onSelect={() => startRename(conversation)}>
                            <Pencil />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(conversation)}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <AlertDialog open={deleting !== null} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete &quot;{deleting?.title}&quot; and all of its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
