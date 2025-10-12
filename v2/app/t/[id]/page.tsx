import type { Metadata } from 'next';
import { getTrackById, getArtworkUrl } from '@/lib/audius';
import { TrackLoader } from '@/components/TrackLoader';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = await getTrackById(params.id);
  const title = t?.title ? `${t.title} — th3scr1b3` : 'Track — th3scr1b3';
  const artwork = getArtworkUrl(t || undefined);
  return {
    title,
    description: t?.title || 'Audius track',
    openGraph: {
      title,
      description: t?.title || 'Audius track',
      images: artwork ? [{ url: artwork }] : undefined,
      type: 'music.song',
    },
    twitter: {
      card: artwork ? 'summary_large_image' : 'summary',
      title,
      description: t?.title || 'Audius track',
      images: artwork ? [artwork] : undefined,
    },
  };
}

export default function TrackPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Track</h1>
      <p className="text-white/70">Loading and playing track…</p>
      <a className="button" href="/">← Back</a>
      <TrackLoader id={params.id} />
    </div>
  );
}
