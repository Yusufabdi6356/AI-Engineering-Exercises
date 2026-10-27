import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { saveRunState } from "../db";
import type { Article } from "../news";

const SCRAPE_LIMIT = 5;
const MAX_TEXT_LENGTH = 8000;

type SearchItem = {
    title: string;
    link: string;
    snippet?: string;
    source?: string;
    imageUrl?: string;
};

type SearchResponse = {
    knowledgeGraph?: {
        title: string;
        description: string;
        descriptionLink?: string;
        descriptionSource?: string;
        imageUrl?: string;
    };
    topStories?: SearchItem[];
    organic?: SearchItem[];
    news?: SearchItem[];
};

type ScrapeResult = { ok: true; text: string } | { ok: false; error: string };

function toArticle(item: SearchItem): Article {
    return {
        title: item.title,
        link: item.link,
        summary: item.snippet || `Latest news from ${item.source}`,
        source: item.source,
        imageUrl: item.imageUrl,
    };
}

export const serperSearchTool = createTool({
    name: "serper_search",
    description: "Search for latest news articles about ANY topic (AI, sports, politics, technology, etc)",
    parameters: z.object({
        query: z.string().describe("Search query - any topic the user wants news about")
    }),

    handler: async (input, { network, step }) => {

        const response = await step?.run('serper_api_call', async () => {
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY || '',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: input.query,
                    page: 1
                })
            })

            if (!res.ok) {
                throw new Error(`Serper search returned status ${res.status}`);
            }

            const data: SearchResponse = await res.json();
            return data;
        })

        if (!response) {
            return { success: false, count: 0 };
        }

        const articles: Article[] = [];

        if (response.knowledgeGraph) {
            articles.push({
                title: response.knowledgeGraph.title,
                link: response.knowledgeGraph.descriptionLink || '',
                summary: response.knowledgeGraph.description,
                source: response.knowledgeGraph.descriptionSource || 'Knowledge Graph',
                imageUrl: response.knowledgeGraph.imageUrl,
            })
        }

        articles.push(...(response.topStories || []).map(toArticle));
        articles.push(...(response.organic || []).map(toArticle));

        if (articles.length === 0) {
            articles.push(...(response.news || []).map(toArticle));
        }

        articles
            .filter((article) => article.link)
            .slice(0, SCRAPE_LIMIT)
            .forEach((article) => {
                article.scrapeStatus = 'pending';
            });

        network.state.data.articles = articles;

        await step?.run('save_articles', () => saveRunState(network.state.data.runId, { 'state.articles': articles }));

        return { success: true, count: articles.length };
    }
})

async function scrapePage(url: string): Promise<ScrapeResult> {
    try {
        if (!process.env.SERPER_API_KEY) {
            throw new Error('SERPER_API_KEY is missing');
        }

        const res = await fetch('https://scrape.serper.dev', {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                includeMarkdown: true
            }),
            signal: AbortSignal.timeout(30000)
        })

        if (!res.ok) {
            throw new Error(`Serper scrape returned status ${res.status}`);
        }

        const data = await res.json();
        const text: string = data.markdown || data.text || '';

        if (!text.trim()) {
            throw new Error('Serper scrape returned no text');
        }

        return { ok: true, text: text.slice(0, MAX_TEXT_LENGTH) };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export const serperScrapeTool = createTool({
    name: "scrape_article",
    description: "Scrape the full text of a news article page with the Serper webpage scraper",
    parameters: z.object({
        url: z.string().describe("The link of the article to scrape")
    }),

    handler: async ({ url }, { network, step }) => {

        const page = await step?.run('serper_scrape_call', () => scrapePage(url));

        const articles: Article[] = network.state.data.articles || [];
        const matches = articles.filter((article) => article.link === url);

        if (matches.length === 0) {
            return { success: false, url, error: 'This link is not one of the found articles' };
        }

        matches.forEach((article) => {
            if (page?.ok) {
                article.fullText = page.text;
                article.scrapeStatus = 'full text';
            } else {
                article.scrapeStatus = 'snippet only';
                article.scrapeError = page ? page.error : 'Page could not be scraped';
            }
        });

        await step?.run('save_articles', () => saveRunState(network.state.data.runId, { 'state.articles': articles }));

        if (page?.ok) {
            return { success: true, url, status: 'full text', characters: page.text.length };
        }

        return { success: true, url, status: 'snippet only', reason: matches[0].scrapeError };
    }
})
