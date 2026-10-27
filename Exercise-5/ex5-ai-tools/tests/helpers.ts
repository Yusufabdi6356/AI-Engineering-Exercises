import mongoose from 'mongoose';
import { vi } from 'vitest';
import { connectToDatabase } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

async function dropTestDatabase() {
  if (!mongoose.connection.name.endsWith('-test')) {
    throw new Error(`Refusing to drop "${mongoose.connection.name}", tests must use a -test database`);
  }
  await mongoose.connection.dropDatabase();
}

export async function setupTestDatabase() {
  await connectToDatabase();
  await dropTestDatabase();
  await seedDatabase();
}

export async function closeTestDatabase() {
  await dropTestDatabase();
  await mongoose.disconnect();
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function failingFetch() {
  return mockFetch(() => {
    throw new TypeError('fetch failed');
  });
}

export function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
