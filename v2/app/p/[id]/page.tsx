import type { Metadata } from 'next';
import { getPlaylistById, getArtworkUrl } from '@/lib/audius';
import { PlaylistLoader } from '@/components/PlaylistLoader';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getPlaylistById(params.id);
  const name = p?.playlist_name || 'Collection';
  const title = `${name} — th3scr1b3`;
  const artwork = getArtworkUrl(p || undefined);
  return {
    title,
    description: p?.is_album ? 'Album on Audius' : 'Playlist on Audius',
    openGraph: {
      title,
      description: p?.is_album ? 'Album on Audius' : 'Playlist on Audius',
      images: artwork ? [{ url: artwork }] : undefined,
      type: p?.is_album ? 'music.album' : 'music.playlist',
    },
    twitter: {
      card: artwork ? 'summary_large_image' : 'summary',
      title,
      description: p?.is_album ? 'Album on Audius' : 'Playlist on Audius',
      images: artwork ? [artwork] : undefined,
    },
  };
}

export default function PlaylistPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Collection</h1>
      <p className="text-white/70">Loading and playing collection…</p>
      <a className="button" href="/">← Back</a>
      <PlaylistLoader id={params.id} />
    </div>
  );
}
