import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serperScrapeTool, serperSearchTool } from '@/lib/tools/serper';
import type { Article } from '@/lib/news';

const { updateOne } = vi.hoisted(() => ({ updateOne: vi.fn() }));

vi.mock('mongodb', () => ({
    MongoClient: class {
        connect() {
            return Promise.resolve(this);
        }
        db() {
            return { collection: () => ({ updateOne }) };
        }
    },
}));

type ToolContext = Parameters<typeof serperScrapeTool.handler>[1];

const step = { run: async (_id: string, fn: () => unknown) => fn() };

function makeNetwork(articles: Article[]) {
    return { state: { data: { runId: 'run_test', articles } as Record<string, unknown> } };
}

function context(network: ReturnType<typeof makeNetwork>) {
    return { network, step } as unknown as ToolContext;
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function scrape(url: string, network: ReturnType<typeof makeNetwork>) {
    return serperScrapeTool.handler({ url }, context(network));
}

describe('serperScrapeTool', () => {
    let articles: Article[];

    beforeEach(() => {
        updateOne.mockReset();
        articles = [
            { title: 'Chip plant opens', link: 'https://news.example.com/chips', summary: 'A new plant opened.', scrapeStatus: 'pending' },
            { title: 'Robots at the port', link: 'https://news.example.com/robots', summary: 'Robots arrive.', scrapeStatus: 'pending' },
        ];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('posts the url to the Serper scraper and saves the full text with the article', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({
            text: 'Plain text of the page',
            markdown: '# Chip plant opens\n\nThe plant employs 1,240 people.',
            metadata: { title: 'Chip plant opens' },
        }));
        vi.stubGlobal('fetch', fetchMock);
        const network = makeNetwork(articles);

        const result = await scrape('https://news.example.com/chips', network);

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://scrape.serper.dev');
        expect(init.method).toBe('POST');
        expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('test-serper-key');
        expect(JSON.parse(init.body as string)).toEqual({ url: 'https://news.example.com/chips', includeMarkdown: true });

        expect(articles[0].fullText).toBe('# Chip plant opens\n\nThe plant employs 1,240 people.');
        expect(articles[0].scrapeStatus).toBe('full text');
        expect(articles[1].scrapeStatus).toBe('pending');
        expect(result).toEqual({ success: true, url: 'https://news.example.com/chips', status: 'full text', characters: 51 });

        const [filter, update] = updateOne.mock.calls[0];
        expect(filter).toEqual({ runId: 'run_test', status: 'running' });
        expect(update.$set['state.articles'][0].fullText).toContain('1,240 people');
    });

    it('uses the plain text when the page has no markdown', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ text: 'Only plain text here', metadata: {} })));

        await scrape('https://news.example.com/chips', makeNetwork(articles));

        expect(articles[0].fullText).toBe('Only plain text here');
    });

    it('keeps only the first 8000 characters of the page', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ markdown: 'a'.repeat(20000) })));

        const result = await scrape('https://news.example.com/chips', makeNetwork(articles));

        expect(articles[0].fullText).toHaveLength(8000);
        expect(result).toMatchObject({ characters: 8000 });
    });

    it('falls back to the snippet and records why when Serper returns an error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Failed to scrape' }, 500)));

        const result = await scrape('https://news.example.com/robots', makeNetwork(articles));

        expect(articles[1].fullText).toBeUndefined();
        expect(articles[1].summary).toBe('Robots arrive.');
        expect(articles[1].scrapeStatus).toBe('snippet only');
        expect(articles[1].scrapeError).toBe('Serper scrape returned status 500');
        expect(result).toEqual({ success: true, url: 'https://news.example.com/robots', status: 'snippet only', reason: 'Serper scrape returned status 500' });
        expect(updateOne.mock.calls[0][1].$set['state.articles'][1].scrapeError).toBe('Serper scrape returned status 500');
    });

    it('falls back to the snippet when the request itself fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new TypeError('fetch failed');
        }));

        await scrape('https://news.example.com/robots', makeNetwork(articles));

        expect(articles[1].scrapeStatus).toBe('snippet only');
        expect(articles[1].scrapeError).toBe('fetch failed');
    });

    it('falls back to the snippet when the page has no text', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ text: '', markdown: '  ' })));

        await scrape('https://news.example.com/robots', makeNetwork(articles));

        expect(articles[1].scrapeStatus).toBe('snippet only');
        expect(articles[1].scrapeError).toBe('Serper scrape returned no text');
    });

    it('does not call Serper without an API key', async () => {
        vi.stubEnv('SERPER_API_KEY', '');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await scrape('https://news.example.com/chips', makeNetwork(articles));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(articles[0].scrapeStatus).toBe('snippet only');
        expect(articles[0].scrapeError).toBe('SERPER_API_KEY is missing');
    });

    it('ignores links that are not one of the found articles', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ markdown: 'Some page' })));

        const result = await scrape('https://somewhere-else.example.com', makeNetwork(articles));

        expect(result).toMatchObject({ success: false });
        expect(articles.every((article) => article.scrapeStatus === 'pending')).toBe(true);
        expect(updateOne).not.toHaveBeenCalled();
    });
});

describe('serperSearchTool', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('marks the top five linked results to be scraped', async () => {
        const organic = Array.from({ length: 7 }, (_, i) => ({
            title: `Story ${i + 1}`,
            link: `https://news.example.com/story-${i + 1}`,
            snippet: `Snippet ${i + 1}`,
            source: 'Example News',
        }));
        const fetchMock = vi.fn(async () => jsonResponse({
            knowledgeGraph: { title: 'Artificial intelligence', description: 'A field of study' },
            organic,
        }));
        vi.stubGlobal('fetch', fetchMock);
        const network = makeNetwork([]);

        await serperSearchTool.handler({ query: 'AI technology' }, context(network));

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://google.serper.dev/search');
        expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('test-serper-key');

        const statuses = (network.state.data.articles as Article[]).map((article) => article.scrapeStatus);
        expect(statuses).toEqual([undefined, 'pending', 'pending', 'pending', 'pending', 'pending', undefined, undefined]);
    });
});
