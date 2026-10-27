'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { ArrowUp, Square, AlertCircle, RotateCcw } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import ModelPicker from '@/components/model-picker';
import MessageActions from '@/components/message-actions';
import { rateMessage } from '@/app/actions';
import { defaultModel } from '@/lib/chat-models';
import type { ChatMessage, Feedback } from '@/lib/chat-store';

interface ChatProps {
  conversationId: string;
  initialMessages: ChatMessage[];
}

export default function Chat({ conversationId, initialMessages }: ChatProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [model, setModel] = useState(defaultModel);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, sendMessage, regenerate, status, error, stop } = useChat<ChatMessage>({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({ messages, id, trigger, messageId, body }) {
        return {
          body: {
            ...body,
            id,
            message: messages[messages.length - 1],
            trigger,
            messageId,
          },
        };
      },
    }),
    onFinish: () => router.refresh(),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const rate = async (messageId: string, feedback: Feedback | null) => {
    await rateMessage(messageId, feedback);
    setMessages(current =>
      current.map(msg => (msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, feedback } } : msg)),
    );
  };

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 px-3">
        <SidebarTrigger />
        <ModelPicker value={model} onChange={setModel} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
          {messages.length === 0 && (
            <div className="pt-24 text-center sm:pt-32">
              <h2 className="text-2xl font-semibold">What can I help with?</h2>
            </div>
          )}

          {messages.map(message => {
            const text = message.parts.map(part => (part.type === 'text' ? part.text : '')).join('');

            if (message.role === 'user') {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl bg-muted px-5 py-2.5 whitespace-pre-wrap break-words">
                    {text}
                  </div>
                </div>
              );
            }

            const isStreaming = status === 'streaming' && message.id === messages[messages.length - 1].id;

            return (
              <div key={message.id} className="space-y-2">
                <Streamdown className="leading-7 break-words" parseIncompleteMarkdown={true}>
                  {text}
                </Streamdown>
                {!isStreaming && (
                  <MessageActions
                    text={text}
                    model={message.metadata?.model}
                    feedback={message.metadata?.feedback}
                    disabled={status !== 'ready'}
                    onRegenerate={() => regenerate({ messageId: message.id, body: { model } })}
                    onRate={feedback => rate(message.id, feedback)}
                  />
                )}
              </div>
            );
          })}

          {status === 'submitted' && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0.1s' }}></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-800">Something went wrong. Please try again.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="border-red-200 text-red-600 hover:bg-red-100"
              >
                <RotateCcw />
                Retry
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            if (input.trim() && status === 'ready') {
              sendMessage({ text: input }, { body: { model } });
              setInput('');
            }
          }}
          className="mx-auto flex max-w-3xl items-center gap-2 rounded-3xl border bg-background py-2 pr-2 pl-5 shadow-sm"
        >
          <input
            className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted-foreground"
            value={input}
            placeholder="Ask anything"
            maxLength={4000}
            aria-label="Message"
            onChange={e => setInput(e.target.value)}
          />
          {status === 'submitted' || status === 'streaming' ? (
            <Button type="button" size="icon" className="rounded-full" onClick={() => stop()} aria-label="Stop">
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              disabled={status !== 'ready' || !input.trim()}
              aria-label="Send"
            >
              <ArrowUp />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
