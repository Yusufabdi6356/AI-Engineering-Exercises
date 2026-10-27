"use client"

import ArticleCard from "@/components/ArticleCard";
import JobStatus from "@/components/JobStatus";
import PosterCard from "@/components/PosterCard";
import PostsCard from "@/components/PostsCard";
import SearchInput from "@/components/SearchInput";
import SentimentCard from "@/components/SentimentCard";
import type { Article } from "@/lib/news";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";


export default function Home() {

  const [input, setInput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');


  const { data: result, error: loadError } = useQuery({
    queryKey: ['results', runId],
    queryFn: async () => {
      const response = await fetch(`/api/results/${runId}`);
      if (!response.ok) {
        throw new Error('Could not load the results of this run.');
      }
      return response.json();
    },
    enabled: !!runId,
    refetchInterval: (query) => query.state.data?.status === 'running' ? 2000 : false,
  })


  const handleRun = async () => {
    const query = input.trim();

    if (!query) {
      setStartError('Please enter a search query');
      return
    }

    setStarting(true);
    setStartError('');

    try {
      const res = await fetch('/api/run-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStartError(data.error || 'Failed to run agents. Please try again.');
        return;
      }

      setRunId(data.runId);
    } catch {
      setStartError('Failed to run agents. Please try again.');
    } finally {
      setStarting(false);
    }
  }


  const state = result?.state || {};
  const articles: Article[] = state.articles || [];
  const isRunning = starting || result?.status === 'running';


  return (
    <main className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-900">AI News Agents</h1>
          <p className="text-gray-600 mt-1">Multi-agent system with intelligent routing</p>
        </div>

        <SearchInput
          input={input}
          error={startError || loadError?.message}
          onInputChange={setInput}
          onRun={handleRun}
          isRunning={isRunning}
        />

        {
          result && (
            <>
              <JobStatus
                status={result.status}
                error={result.error}
                articles={articles.length}
                fullText={articles.filter((article) => article.scrapeStatus === 'full text').length}
                snippetOnly={articles.filter((article) => article.scrapeStatus === 'snippet only').length}
                sentiments={state.sentiments?.length}
                posts={state.posts?.length}
                posters={state.posters?.length}
                approved={state.approved}
              />

              <div className="grid md:grid-cols-2 gap-6">

                <ArticleCard articles={articles} />
                <SentimentCard sentiments={state.sentiments || []} />
                <PostsCard posts={state.posts || []} />
                <PosterCard posters={state.posters || []} />

              </div>

            </>
          )
        }

      </div>
    </main>
  );
}
