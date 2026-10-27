import { describe, expect, it } from 'vitest';
import { articleReaderAgent, contentCreatorAgent, sentimentAnalyzerAgent } from '@/lib/agents';

const articles = [
    {
        title: 'Chip plant opens',
        link: 'https://news.example.com/chips',
        summary: 'Snippet about a chip plant.',
        fullText: 'The plant in Leuven employs 1,240 people and cost 3.1 billion euros.',
        scrapeStatus: 'full text',
    },
    {
        title: 'Robots at the port',
        link: 'https://news.example.com/robots',
        summary: 'Snippet about robots.',
        scrapeStatus: 'snippet only',
        scrapeError: 'Serper scrape returned status 500',
    },
    {
        title: 'New AI rules',
        link: 'https://news.example.com/rules',
        summary: 'Snippet about rules.',
        scrapeStatus: 'pending',
    },
];

function systemPrompt(agent: { system: unknown }) {
    const network = { state: { data: { articles, sentiments: [] } } };
    return (agent.system as (ctx: unknown) => string)({ network });
}

describe('agent prompts', () => {
    it('gives the sentiment analyzer the full text instead of the snippet', () => {
        const prompt = systemPrompt(sentimentAnalyzerAgent);

        expect(prompt).toContain('employs 1,240 people');
        expect(prompt).not.toContain('Snippet about a chip plant.');
        expect(prompt).toContain('Snippet about robots.');
    });

    it('gives the content creator the full text instead of the snippet', () => {
        const prompt = systemPrompt(contentCreatorAgent);

        expect(prompt).toContain('employs 1,240 people');
        expect(prompt).not.toContain('Snippet about a chip plant.');
        expect(prompt).toContain('Snippet about robots.');
    });

    it('asks the article reader to scrape only the articles still waiting', () => {
        const prompt = systemPrompt(articleReaderAgent);

        expect(prompt).toContain('https://news.example.com/rules');
        expect(prompt).not.toContain('https://news.example.com/chips');
        expect(prompt).not.toContain('https://news.example.com/robots');
    });
});
