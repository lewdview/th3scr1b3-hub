import { NextResponse } from 'next/server';
import { getUserByHandle } from '@/lib/audius';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle');
  if (!handle) return NextResponse.json({ error: 'Missing handle' }, { status: 400 });

  // Try exact and search; return candidates for manual selection
  const exact = await getUserByHandle(handle);
  // For visibility, also fetch search candidates directly
  const query = encodeURIComponent(handle);
  const search = await fetch(`https://discovery-provider.audius.co/v1/users/search?query=${query}&limit=5&offset=0&app_name=th3scr1b3-v2`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }));
  const candidates = search?.data ?? [];

  return NextResponse.json({ data: exact, candidates }, { status: exact ? 200 : 404 });
}
