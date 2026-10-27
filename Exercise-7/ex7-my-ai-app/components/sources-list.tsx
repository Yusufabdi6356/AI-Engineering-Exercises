import { Badge } from '@/components/ui/badge';
import type { Source } from '@/lib/types';

export function SourcesList({ sources }: { sources: Source[] }) {
  return (
    <ol className="space-y-3">
      {sources.map((source, index) => (
        <li key={index} className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary">Page {source.page}</Badge>
            <span className="text-xs text-muted-foreground">Relevance {Math.round(source.score * 100)}%</span>
          </div>
          <p className="line-clamp-3 text-sm text-muted-foreground">{source.content}</p>
        </li>
      ))}
    </ol>
  );
}
