'use client';

import { useChat } from '@ai-sdk/react';
import { generateId } from 'ai';
import { useEffect, useRef, useState } from 'react';
import DatabaseResult from '@/components/DatabaseResult';
import JokeList from '@/components/JokeList';
import MovieCard from '@/components/MovieCard';
import SettingsBar from '@/components/SettingsBar';
import ToolStats from '@/components/ToolStats';
import type { ChatMessage } from '@/tools';

const examples = [
  'Show me all sci-fi movies',
  'Find users over 25',
  'Get movies with rating above 8.5',
  'Count total movies by genre',
  'Tell me about the movie Inception',
  'Tell me a programming joke',
  'Find jokes about cats',
];

export default function Chat() {
  const [input, setInput] = useState('');
  const [chatId, setChatId] = useState(() => generateId());
  const [statsVersion, setStatsVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, regenerate, stop } = useChat<ChatMessage>({
    id: chatId,
    onFinish: () => setStatsVersion(version => version + 1),
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const clearChat = () => {
    stop();
    setChatId(generateId());
    setInput('');
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b px-4 py-4 text-center">
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Movies, Database and Jokes</h1>
        <p className="mb-3 text-sm text-gray-600 sm:text-base">
          Ask about the movie database, look up a film or hear a joke
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <SettingsBar />
          <button
            onClick={clearChat}
            className="rounded-lg border px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            Clear chat
          </button>
        </div>
      </div>

      <ToolStats refreshKey={statsVersion} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Try these prompts:</h3>
              <div className="flex flex-wrap gap-2">
                {examples.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs hover:bg-gray-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'max-w-md bg-rose-500 text-white'
                    : 'w-full max-w-3xl bg-gray-100 text-gray-900'
                }`}
              >
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return <div key={i} className="whitespace-pre-wrap">{part.text}</div>;
                    case 'tool-queryDatabase':
                      return <DatabaseResult key={i} part={part} />;
                    case 'tool-searchMovie':
                      return <MovieCard key={i} part={part} />;
                    case 'tool-getJokes':
                      return <JokeList key={i} part={part} />;
                    default:
                      return null;
                  }
                })}
              </div>
            </div>
          ))}

          {status === 'submitted' && <div className="text-sm text-gray-500">Thinking...</div>}

          {error && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error.message || 'Something went wrong. Please try again.'}</span>
              <button
                onClick={() => regenerate()}
                className="rounded border border-red-300 bg-white px-3 py-1 text-xs hover:bg-red-100"
              >
                Try again
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-white p-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            sendMessage({ text: input });
            setInput('');
          }}
          className="mx-auto max-w-4xl"
        >
          <div className="flex space-x-2">
            <input
              className="flex-1 rounded-lg border p-3"
              value={input}
              maxLength={1000}
              placeholder="Try: Show me all sci-fi movies"
              onChange={e => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-rose-500 px-4 py-3 text-white hover:bg-rose-600 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
