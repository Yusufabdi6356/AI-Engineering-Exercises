import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';

async function dropTestDatabase() {
  if (!mongoose.connection.name.endsWith('-test')) {
    throw new Error(`Refusing to drop "${mongoose.connection.name}", tests must use a -test database`);
  }
  await mongoose.connection.dropDatabase();
}

export async function setupTestDatabase() {
  await connectDB();
  await dropTestDatabase();
}

export async function closeTestDatabase() {
  await dropTestDatabase();
  await mongoose.disconnect();
}

export function uploadRequest(bytes: Uint8Array, name = 'honeybees.pdf', type = 'application/pdf') {
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array(bytes)], name, { type }));
  return new NextRequest('http://localhost:3007/api/upload', { method: 'POST', body: formData });
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeParams(podcastId: string) {
  return { params: Promise.resolve({ podcastId }) };
}

export async function readChunks(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  return chunks;
}
