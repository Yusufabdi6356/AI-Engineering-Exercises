'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { FileUpload } from '@/components/file-upload';
import { DocumentList } from '@/components/document-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeError, errorMessage } from '@/lib/utils';
import type { DocumentItem } from '@/lib/types';

export default function LibraryPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error(await errorMessage(response, 'Could not load your documents.'));
      }
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      setError(describeError(error, 'Could not load your documents.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Upload a PDF</CardTitle>
          <CardDescription>
            The PDF is split into chunks, embedded and stored in Pinecone so episodes can cite its pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onUploaded={fetchDocuments} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Your library
            <Badge variant="secondary">{documents.length}</Badge>
          </CardTitle>
          <CardDescription>Pick a document to turn it into an episode.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading documents...
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Could not load your library</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={fetchDocuments}>
                  <RotateCcw />
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <DocumentList
              documents={documents}
              onDeleted={(documentId) =>
                setDocuments((prev) => prev.filter((doc) => doc.documentId !== documentId))
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
