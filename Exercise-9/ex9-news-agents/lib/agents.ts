import { createAgent, openai } from "@inngest/agent-kit";
import { serperScrapeTool, serperSearchTool } from "./tools/serper";
import { approveContentTool, savePostsTool, saveSentimentsTool } from "./tools/save";
import { generatePosterTool } from "./tools/imageGenerator";
import type { Article } from "./news";

export const model = openai({
    model: "openai/gpt-5-mini",
    baseUrl: "https://openrouter.ai/api/v1/",
    apiKey: process.env.OPENROUTER_API_KEY,
})

const articleTexts = (articles: Article[]) => articles.map((article) => ({
    title: article.title,
    source: article.source,
    text: article.fullText || article.summary,
}))

export const newsScoutAgent = createAgent({
    name: "news-scout",
    description: "A news scout agent that can search the web for the latest news and articles",
    system: `
    You are an expert news researcher. Your job is to:
    1. Search for the latest news using the serper_search tool based on the user's query
    2. The query can be about ANY topic: AI, sports, politics, technology, entertainment, etc
    3. Use the exact topic the user requested
    4. Return relevant and current news articles

ALWAYS use the serper_search tool with the user's query.
    `,
    tools: [serperSearchTool],
    tool_choice: "serper_search",
    model
})

export const articleReaderAgent = createAgent({
    name: "article-reader",
    description: "Scrapes the full text of the top articles found by the news scout",
    system: ({ network }) => {
        const articles: Article[] = network?.state.data.articles || [];
        const pending = articles.filter((article) => article.scrapeStatus === 'pending');

        return `
        You are an article reader. These articles still need their full text:
        ${pending.map((article) => `- ${article.title}: ${article.link}`).join('\n')}

        Use the scrape_article tool with the link of the first article in the list.
        `
    },
    tools: [serperScrapeTool],
    tool_choice: "scrape_article",
    model
})

export const sentimentAnalyzerAgent = createAgent({
    name: "sentiment-analyzer",
    description: "Analyzes sentiment of articles",
    system: ({ network }) => {
        const articles = network?.state.data.articles || [];

        return `

        You are a sentiment analysis expert. Analyze these articles:
        ${JSON.stringify(articleTexts(articles), null, 2)}

        Each text is the full article when it could be scraped, otherwise the search snippet.

        For each article, determine:
        1. Sentiment (positive, negative, neutral)
        2. Score (0-1)
        3. Brief reasoning that points to specific details from the article text

        MUST use the save_sentiments tool to store your analysis.
        `},
    tools: [saveSentimentsTool],
    tool_choice: "save_sentiments",
    model
})

export const contentCreatorAgent = createAgent({

    name: "content-creator",
    description: "Create social media posts",
    system: ({ network }) => {
        const articles = network?.state.data.articles || [];
        const sentiments = network?.state.data.sentiments || [];

        return `
        You are a social media expert. Create engaging posts from these articles:
        Articles: ${JSON.stringify(articleTexts(articles), null, 2)}
        Sentiments: ${JSON.stringify(sentiments, null, 2)}

        Create 2-3 posts per article:
        - One Twitter post (max 280 chars)
        - One LinkedIn post (professional, ~200 chars)
        - Include relevant hashtags
        - Use specific facts from the article text, not just the headline

        MUST use the save_posts tool to store your posts.`
    },

    tools: [savePostsTool],
    tool_choice: "save_posts",
    model
})

export const posterGeneratorAgent = createAgent({
    name: "poster-generator",
    description: "Generate social media posters for the social media posts",
    system: ({ network }) => {
        const articles = network?.state.data.articles || [];
        const headlines = articles.map((article: Article) => ({ title: article.title, summary: article.summary }));

        return `
       You are a creative designer. Generate ONE single poster that represents ALL the content:
        Articles: ${JSON.stringify(headlines, null, 2)}


        Use generate_poster tool ONCE to create a single, eye-catching poster.
        Create ONE image prompt that captures the essence of all the content in a professional, modern design.
        use fewer words in the prompt.
        IMPORTANT: Call generate_poster only ONE time with a comprehensive prompt.
        `
    },
    tools: [generatePosterTool],
    tool_choice: "generate_poster",
    model
})

export const moderatorAgent = createAgent({
    name: "moderator",
    description: "Reviews and approves content",
    system: ({ network }) => {

        const articles = network?.state.data.articles || [];
        const posts = network?.state.data.posts || [];
        const posters = network?.state.data.posters || [];

        return `
            You are a content moderator. Review all content:
            Articles (${articles.length}): ${JSON.stringify(articles.slice(0, 1), null, 2)}...
            Posts (${posts.length}): ${JSON.stringify(posts.slice(0, 1), null, 2)}...
            Posters (${posters.length}): Generated

            Check:
            1. Is content accurate?
            2. Are posts appropriate?
            3. Is everything ready to publish?

            MUST use approve_content tool to approve the content.

        `
    },
    tools: [approveContentTool],
    tool_choice: "approve_content",
    model
})
