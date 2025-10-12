import { NextResponse } from 'next/server';
import { getPlaylistById } from '@/lib/audius';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const playlist = await getPlaylistById(id);
  if (!playlist) return NextResponse.json({ data: null }, { status: 404 });
  return NextResponse.json({ data: playlist }, { status: 200, headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
}
