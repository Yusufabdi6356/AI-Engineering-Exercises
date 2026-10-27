import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument, getAllDocuments, getDocument } from '@/lib/mongodb';
import { deleteDocumentVectors } from '@/lib/pinecone';
import { missingKeys } from '@/lib/env';
import { friendlyMessage } from '@/lib/errors';

export async function GET() {
  try {
    const documents = await getAllDocuments();
    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error('Loading documents failed:', error);
    return NextResponse.json(
      { error: 'Could not load your documents. Check that MongoDB is running.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
  }

  const missing = missingKeys(['PINECONE_API_KEY', 'PINECONE_INDEX_NAME'], 'delete document vectors');
  if (missing) {
    return NextResponse.json({ error: missing }, { status: 503 });
  }

  try {
    if (!(await getDocument(documentId))) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await deleteDocumentVectors(documentId);
    await deleteDocument(documentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deleting document failed:', error);
    return NextResponse.json({ error: friendlyMessage(error, 'Failed to delete document') }, { status: 500 });
  }
}
