import { NextResponse } from 'next/server';
import { getCollectionsForUserId } from '@/lib/audius';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  const collections = await getCollectionsForUserId(userId);
  return NextResponse.json({ data: collections }, { status: 200, headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
}
