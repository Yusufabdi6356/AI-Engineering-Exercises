export interface DocumentItem {
  documentId: string;
  title: string;
  filename: string;
  fileSize: number;
  pageCount: number;
  chunkCount: number;
  uploadedAt: string;
}

export interface Chunk {
  content: string;
  page: number;
}

export interface Source {
  page: number;
  content: string;
  score: number;
}

export interface PodcastItem {
  podcastId: string;
  documentId: string;
  documentTitle: string;
  script: string;
  sources: Source[];
  hasAudio: boolean;
  createdAt: string;
}
