import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDB } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!/^[0-9a-f]{24}$/.test(id)) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    const db = await getDB();
    const poster = await db.collection('posters').findOne({ _id: new ObjectId(id) });

    if (!poster || typeof poster.image !== 'string') {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(Buffer.from(poster.image, 'base64')), {
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (error) {
    console.error('Error fetching poster:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch poster' }, { status: 500 });
  }
}
