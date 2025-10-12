import { NextResponse } from 'next/server';
import { getStreamUrl } from '@/lib/audius';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get('trackId');
  if (!trackId) return NextResponse.json({ error: 'Missing trackId' }, { status: 400 });
  const target = `https://discovery-provider.audius.co/v1/tracks/${encodeURIComponent(trackId)}/stream?app_name=th3scr1b3-v2`;
  return NextResponse.redirect(target, { status: 307 });
}
