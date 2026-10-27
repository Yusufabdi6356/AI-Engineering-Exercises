'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Mic, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { describeError, errorMessage, formatDate } from '@/lib/utils';
import type { DocumentItem } from '@/lib/types';

interface DocumentListProps {
  documents: DocumentItem[];
  onDeleted: (documentId: string) => void;
}

export function DocumentList({ documents, onDeleted }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (documentId: string) => {
    if (deletingId) return;
    setDeletingId(documentId);

    try {
      const response = await fetch(`/api/documents?documentId=${documentId}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error(await errorMessage(response, 'Failed to delete document'));
      }

      onDeleted(documentId);
      toast.success('Document deleted');
    } catch (error) {
      toast.error(describeError(error, 'Failed to delete document'));
    } finally {
      setDeletingId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <FileText className="mx-auto mb-3 size-10 opacity-40" />
        <p className="font-medium text-foreground">No documents yet</p>
        <p className="text-sm">Upload a PDF to make your first episode.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {documents.map((doc) => (
        <li key={doc.documentId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground">
                {doc.pageCount} pages, {doc.chunkCount} chunks, uploaded {formatDate(doc.uploadedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild>
              <Link href={`/documents/${doc.documentId}`}>
                <Mic />
                Make episode
              </Link>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${doc.title}`}
              onClick={() => handleDelete(doc.documentId)}
              disabled={deletingId === doc.documentId}
              className="text-muted-foreground hover:text-destructive"
            >
              {deletingId === doc.documentId ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
