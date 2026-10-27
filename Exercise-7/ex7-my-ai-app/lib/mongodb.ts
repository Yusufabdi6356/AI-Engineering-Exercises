import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import type { DocumentItem, PodcastItem } from './types';

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
}

const DocumentSchema = new mongoose.Schema({
  documentId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  filename: { type: String, required: true },
  fileSize: { type: Number, required: true },
  pageCount: { type: Number, required: true },
  chunkCount: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const SourceSchema = new mongoose.Schema(
  {
    page: { type: Number, required: true },
    content: { type: String, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const PodcastSchema = new mongoose.Schema({
  podcastId: { type: String, required: true, unique: true },
  documentId: { type: String, required: true },
  documentTitle: { type: String, required: true },
  script: { type: String, required: true },
  sources: { type: [SourceSchema], default: [] },
  hasAudio: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

type DocumentRecord = InferSchemaType<typeof DocumentSchema>;
type PodcastRecord = InferSchemaType<typeof PodcastSchema>;

export const Document =
  (mongoose.models.Document as Model<DocumentRecord>) || mongoose.model('Document', DocumentSchema);
export const Podcast =
  (mongoose.models.Podcast as Model<PodcastRecord>) || mongoose.model('Podcast', PodcastSchema);

function toDocumentItem(doc: DocumentRecord): DocumentItem {
  return {
    documentId: doc.documentId,
    title: doc.title,
    filename: doc.filename,
    fileSize: doc.fileSize,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    uploadedAt: new Date(doc.uploadedAt).toISOString(),
  };
}

function toPodcastItem(podcast: PodcastRecord): PodcastItem {
  return {
    podcastId: podcast.podcastId,
    documentId: podcast.documentId,
    documentTitle: podcast.documentTitle,
    script: podcast.script,
    sources: podcast.sources.map((source) => ({
      page: source.page,
      content: source.content,
      score: source.score,
    })),
    hasAudio: podcast.hasAudio,
    createdAt: new Date(podcast.createdAt).toISOString(),
  };
}

export async function createDocument(doc: Omit<DocumentItem, 'uploadedAt'>): Promise<void> {
  await connectDB();
  await Document.create(doc);
}

export async function getDocument(documentId: string): Promise<DocumentItem | null> {
  await connectDB();
  const doc = await Document.findOne({ documentId }).lean();
  return doc ? toDocumentItem(doc) : null;
}

export async function getAllDocuments(): Promise<DocumentItem[]> {
  await connectDB();
  const docs = await Document.find({}).sort({ uploadedAt: -1 }).lean();
  return docs.map(toDocumentItem);
}

export async function deleteDocument(documentId: string): Promise<void> {
  await connectDB();
  await Document.deleteOne({ documentId });
}

export async function createPodcast(podcast: Omit<PodcastItem, 'createdAt' | 'hasAudio'>): Promise<void> {
  await connectDB();
  await Podcast.create(podcast);
}

export async function getPodcast(podcastId: string): Promise<PodcastItem | null> {
  await connectDB();
  const podcast = await Podcast.findOne({ podcastId }).lean();
  return podcast ? toPodcastItem(podcast) : null;
}

export async function getAllPodcasts(): Promise<PodcastItem[]> {
  await connectDB();
  const podcasts = await Podcast.find({}).sort({ createdAt: -1 }).lean();
  return podcasts.map(toPodcastItem);
}

export async function markPodcastAudio(podcastId: string): Promise<void> {
  await connectDB();
  await Podcast.updateOne({ podcastId }, { hasAudio: true });
}

export async function deletePodcast(podcastId: string): Promise<void> {
  await connectDB();
  await Podcast.deleteOne({ podcastId });
}
