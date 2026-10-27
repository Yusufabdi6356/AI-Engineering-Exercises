'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        <p>This page could not be loaded. Check that MongoDB is running, then try again.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
