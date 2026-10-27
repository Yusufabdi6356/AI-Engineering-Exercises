import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/podcasts/[podcastId]/audio/route';
import { DELETE } from '@/app/api/podcasts/[podcastId]/route';
import { createPodcast, getPodcast, Podcast } from '@/lib/mongodb';
import { scriptForSpeech } from '@/lib/ai/script';
import { closeTestDatabase, jsonRequest, routeParams, setupTestDatabase } from './helpers';
import { speechCreate } from './mocks';

vi.mock('openai', async () => (await import('./mocks')).openaiModule);

const fakeMp3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21]);
const workDir = mkdtempSync(path.join(tmpdir(), 'ex7-audio-'));
const audioFile = path.join(workDir, 'audio', 'podcast-1.mp3');
const url = 'http://localhost:3007/api/podcasts/podcast-1/audio';

describe('/api/podcasts/[podcastId]/audio', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(workDir);
    rmSync(path.join(workDir, 'audio'), { recursive: true, force: true });
    speechCreate.mockResolvedValue(new Response(fakeMp3));
    await createPodcast({
      podcastId: 'podcast-1',
      documentId: 'doc-1',
      documentTitle: 'honeybees',
      script: 'Welcome to the show [p. 1]. Scouts dance to vote [pp. 2-3].\n\nThanks for listening.',
      sources: [{ page: 1, content: 'Scouts search for a new home.', score: 0.9 }],
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    rmSync(workDir, { recursive: true, force: true });
    await closeTestDatabase();
  });

  it('has no audio before it is recorded', async () => {
    const response = await GET(jsonRequest(url, 'GET'), routeParams('podcast-1'));
    expect(response.status).toBe(404);
  });

  it('records the script with Fish Audio, saves the mp3 and serves it', async () => {
    const response = await POST(jsonRequest(url, 'POST'), routeParams('podcast-1'));

    expect(response.status).toBe(200);
    expect(speechCreate).toHaveBeenCalledWith({
      model: 'fish-audio/s2.1-pro',
      voice: '933563129e564b19a115bedd57b7406a',
      input: 'Welcome to the show. Scouts dance to vote.\n\nThanks for listening.',
      instructions: 'Speak like a warm, engaging podcast host.',
      response_format: 'mp3',
    });
    expect(existsSync(audioFile)).toBe(true);
    expect((await getPodcast('podcast-1'))!.hasAudio).toBe(true);

    const audio = await GET(jsonRequest(url, 'GET'), routeParams('podcast-1'));
    expect(audio.status).toBe(200);
    expect(audio.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(fakeMp3);

    await POST(jsonRequest(url, 'POST'), routeParams('podcast-1'));
    expect(speechCreate).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly message and keeps the episode when TTS fails', async () => {
    speechCreate.mockRejectedValueOnce(new Error('402 Insufficient credits'));

    const response = await POST(jsonRequest(url, 'POST'), routeParams('podcast-1'));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe(
      'Could not record the audio. Check OPENROUTER_API_KEY and your OpenRouter credit, then try again.'
    );
    expect(existsSync(audioFile)).toBe(false);
    expect((await getPodcast('podcast-1'))!.hasAudio).toBe(false);
  });

  it('deleting an episode removes its audio file', async () => {
    await POST(jsonRequest(url, 'POST'), routeParams('podcast-1'));
    expect(existsSync(audioFile)).toBe(true);

    const response = await DELETE(jsonRequest('http://localhost:3007/api/podcasts/podcast-1', 'DELETE'), routeParams('podcast-1'));

    expect(response.status).toBe(200);
    expect(existsSync(audioFile)).toBe(false);
    expect(await getPodcast('podcast-1')).toBeNull();
  });

  it('refuses to send a very long script to TTS', async () => {
    await Podcast.updateOne({ podcastId: 'podcast-1' }, { script: 'Bees dance. '.repeat(300) });

    const response = await POST(jsonRequest(url, 'POST'), routeParams('podcast-1'));

    expect(response.status).toBe(400);
    expect(speechCreate).not.toHaveBeenCalled();
  });

  it('records an episode only once when two requests arrive together', async () => {
    const [first, second] = await Promise.all([
      POST(jsonRequest(url, 'POST'), routeParams('podcast-1')),
      POST(jsonRequest(url, 'POST'), routeParams('podcast-1')),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(speechCreate).toHaveBeenCalledTimes(1);
  });

  it('asks for the OpenRouter key before recording', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const response = await POST(jsonRequest(url, 'POST'), routeParams('podcast-1'));

    expect(response.status).toBe(503);
    expect(speechCreate).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('strips page citations before the script is read aloud', () => {
    expect(scriptForSpeech('Bees vote [p. 2]. They leave [pp. 3-4].')).toBe('Bees vote. They leave.');
  });
});
