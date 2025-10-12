import { NextResponse } from 'next/server';
import { getUserByHandle } from '@/lib/audius';

const ENV_HANDLE = process.env.NEXT_PUBLIC_AUDIUS_HANDLE || process.env.AUDIUS_HANDLE || 'th3Scr1b3';
const ENV_USER_ID = process.env.NEXT_PUBLIC_AUDIUS_USER_ID || process.env.AUDIUS_USER_ID || '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handleParam = searchParams.get('handle') || '';
  const handle = handleParam || ENV_HANDLE;

  // If a userId is configured, return it directly for stability
  if (ENV_USER_ID) {
    return NextResponse.json(
      { data: { id: ENV_USER_ID, handle, name: handle } },
      { status: 200, headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
    );
  }

  const user = await getUserByHandle(handle);
  if (!user) return NextResponse.json({ data: null }, { status: 404 });
  return NextResponse.json({ data: user }, { status: 200, headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
}
