import { createNetwork, createRoutingAgent } from "@inngest/agent-kit";
import { doneTool, routeToAgentTool } from "./tools/router";
import type { Article } from "./news";
import { articleReaderAgent, contentCreatorAgent, model, moderatorAgent, newsScoutAgent, posterGeneratorAgent, sentimentAnalyzerAgent } from "./agents";

const superVisorAgent = createRoutingAgent({
    name: "supervisor",
    description: "AI supervisor that orchestrates the news analysis workflow",
    system: ({ network }) => {
        const state = network?.state.data;
        const agents = Array.from(network?.agents.values() || []);
        const articles: Article[] = state?.articles || [];
        const waiting = articles.filter((article) => article.scrapeStatus === 'pending').length;
        const fullText = articles.filter((article) => article.scrapeStatus === 'full text').length;

        return `You are an intelligent supervisor managing a news analysis workflow.
        **Current State:**
        - Articles found: ${articles.length}
        - Articles waiting to be scraped: ${waiting}
        - Articles with full text: ${fullText}
        - Sentiments analyzed: ${state?.sentiments?.length || 0}
        - Posts created: ${state?.posts?.length || 0}
        - Posters generated: ${state?.posters?.length || 0}
        - Content approved: ${state?.approved !== undefined ? (state.approved ? 'Yes' : 'No') : 'Not yet reviewed'}

        **Available Agents:**
        ${agents.map(a => `- ${a.name}: ${a.description}`).join('\n')}

        **Your Job:**
        1. Analyze the current state
        2. Decide which agent should run next to progress the workflow
        3. Use route_to_agent tool to select the next agent
        4. Use done tool when all steps are complete and content is approved

        **Workflow Logic:**
        - If no articles: route to "news-scout"
        - If articles are waiting to be scraped: route to "article-reader"
        - If no articles are waiting to be scraped but no sentiments: route to "sentiment-analyzer"
        - If sentiments but no posts: route to "content-creator"
        - If posts but no posters: route to "poster-generator"
        - If everything done but not approved: route to "moderator"
        - If approved: call done

        Think step by step and make the best decision!
        `;
    },
    model,
    tools: [routeToAgentTool, doneTool],
    tool_choice: "auto",
    lifecycle: {

        onRoute: ({ result }) => {

            if (!result.toolCalls || result.toolCalls.length === 0) {
                return undefined;
            }

            const tool = result.toolCalls[0];

            if (tool.tool.name === "done") {
                return undefined;
            }

            if (tool.tool.name === "route_to_agent") {
                const agentName = (tool.content as { data?: unknown })?.data;
                return typeof agentName === "string" ? [agentName] : undefined;
            }
            return undefined;
        }
    },
})

export const newsAnalysisNetwork = createNetwork({
    name: "news_analysis_workflow",
    description: "Multi-agent system for news analysis and social media content creation",
    agents:[
        newsScoutAgent,
        articleReaderAgent,
        sentimentAnalyzerAgent,
        contentCreatorAgent,
        posterGeneratorAgent,
        moderatorAgent
    ],
    router: superVisorAgent,
    maxIter: 20
})
