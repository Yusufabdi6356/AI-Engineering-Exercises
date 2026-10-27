'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { AlertCircle, FileText, Loader2, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MAX_FILE_SIZE, describeError, errorMessage } from '@/lib/utils';

interface FileUploadProps {
  onUploaded: () => void;
}

export function FileUpload({ onUploaded }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (selected: File) => {
      setFile(selected);
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', selected);

        const response = await fetch('/api/upload', { method: 'POST', body: formData });

        if (!response.ok) {
          throw new Error(await errorMessage(response, 'Upload failed. Please try again.'));
        }

        const result = await response.json();
        toast.success(`${selected.name} is ready. ${result.message}`);
        setFile(null);
        onUploaded();
      } catch (error) {
        const message = describeError(error, 'Upload failed. Please try again.');
        setError(message);
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      for (const { file: rejected, errors } of rejectedFiles) {
        if (errors.some((item) => item.code === 'file-too-large')) {
          toast.error(`${rejected.name} is too large. Maximum size is 10MB.`);
        } else {
          toast.error(`${rejected.name} is not a PDF. Please upload a PDF file.`);
        }
      }

      if (acceptedFiles.length > 0) {
        uploadFile(acceptedFiles[0]);
      }
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Upload className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{isDragActive ? 'Drop your PDF here' : 'Drag and drop a PDF here'}</p>
          <p className="text-sm text-muted-foreground">or click to choose a file. PDF only, up to 10MB.</p>
        </div>
        <Button type="button" variant="outline" disabled={uploading}>
          Choose PDF
        </Button>
      </div>

      {uploading && file && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <FileText className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">Reading pages, chunking and embedding into Pinecone...</p>
          </div>
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      )}

      {error && !uploading && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{file ? `Could not process ${file.name}` : 'Upload failed'}</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            {file && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => uploadFile(file)}>
                <RotateCcw />
                Try again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
