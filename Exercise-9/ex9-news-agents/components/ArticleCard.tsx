import Image from "next/image";
import type { Article } from "@/lib/news";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type ArticlesCardProps = {
    articles: Article[];
};

const ArticleCard = ({ articles }: ArticlesCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Articles ({articles.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-auto">
          {articles.map((article, i) => (
            <div key={i} className="border p-3 rounded flex gap-3">
              {article.imageUrl && (
                <Image
                  src={article.imageUrl}
                  alt={article.title}
                  width={80}
                  height={80}
                  unoptimized
                  className="w-20 h-20 object-cover rounded shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm">{article.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                    article.scrapeStatus === 'full text' ? 'bg-green-100 text-green-700' :
                    article.scrapeStatus === 'pending' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {article.scrapeStatus === 'full text' ? 'full text' :
                     article.scrapeStatus === 'pending' ? 'scraping...' :
                     'snippet only'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{article.summary}</p>
                {article.scrapeError && (
                  <p className="text-xs text-amber-700 mt-1">Could not scrape: {article.scrapeError}</p>
                )}
                {article.source && (
                  <span className="text-xs text-gray-500 mt-1 inline-block">{article.source}</span>
                )}
                {article.link && (
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 ml-2 inline-block"
                  >
                    Read more →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default ArticleCard
