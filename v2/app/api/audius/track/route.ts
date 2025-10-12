import { NextResponse } from 'next/server';
import { getTrackById } from '@/lib/audius';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const track = await getTrackById(id);
  if (!track) return NextResponse.json({ data: null }, { status: 404 });
  return NextResponse.json({ data: track }, { status: 200, headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
}
