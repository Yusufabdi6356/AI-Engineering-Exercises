import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

function audioPath(podcastId: string): string {
  return path.join(process.cwd(), 'audio', `${podcastId}.mp3`);
}

export async function saveAudio(podcastId: string, audio: Buffer): Promise<void> {
  await mkdir(path.join(process.cwd(), 'audio'), { recursive: true });
  await writeFile(audioPath(podcastId), audio);
}

export async function readAudio(podcastId: string): Promise<Buffer | null> {
  try {
    return await readFile(audioPath(podcastId));
  } catch {
    return null;
  }
}

export async function deleteAudio(podcastId: string): Promise<void> {
  await rm(audioPath(podcastId), { force: true });
}
