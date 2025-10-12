"use client";

import { useEffect } from 'react';
import { usePlayerStore, type Track } from '@/lib/store';
import { getArtworkUrl, getStreamUrl } from '@/lib/audius';

export function PlaylistLoader({ id }: { id: string }) {
  const setQueue = usePlayerStore(s => s.setQueue);
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/audius/playlist?id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const json = await res.json();
      const p = json?.data;
      if (!p?.tracks) return;
      const q: Track[] = p.tracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        streamUrl: getStreamUrl(t.id),
        artwork: getArtworkUrl(t),
        createdAt: t.release_date || undefined,
      }));
      setQueue(q, 0);
    })();
  }, [id, setQueue]);
  return null;
}
