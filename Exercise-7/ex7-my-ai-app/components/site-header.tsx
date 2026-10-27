import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Headphones className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">PDF Podcast Studio</p>
            <p className="hidden text-xs text-muted-foreground sm:block">Turn any PDF into a short narrated episode</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link href="/">Library</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/podcasts">Episodes</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
