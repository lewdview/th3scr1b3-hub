"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePlayerStore, type Track } from '@/lib/store';
import { getArtworkUrl, getStreamUrl } from '@/lib/audius';

const AUDIUS_HANDLE = process.env.NEXT_PUBLIC_AUDIUS_HANDLE || 'th3Scr1b3';

type Collection = { id: string; name: string; isAlbum: boolean; artwork?: string };

export default function CollectionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  const setQueue = usePlayerStore(s => s.setQueue);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const userRes = await fetch(`/api/audius/user`);
        if (!userRes.ok) throw new Error('Audius user not found');
        const userJson = await userRes.json();
        const user = userJson?.data;
        if (!user?.id) throw new Error('Audius user not found');
        const colsRes = await fetch(`/api/audius/collections?userId=${encodeURIComponent(user.id)}`);
        const colsJson = colsRes.ok ? await colsRes.json() : { data: [] };
        const cols = colsJson?.data || [];
        setCollections(cols.map((c: any) => ({
          id: c.id,
          name: c.playlist_name,
          isAlbum: !!c.is_album,
          artwork: getArtworkUrl(c) || undefined,
        })));
      } catch (e: any) {
        setError(e?.message || 'Failed to load collections');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const playCollection = async (id: string) => {
    try {
      const res = await fetch(`/api/audius/playlist?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Playlist not found');
      const json = await res.json();
      const p = json?.data;
      const q: Track[] = p.tracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        streamUrl: getStreamUrl(t.id),
        artwork: getArtworkUrl(t),
        createdAt: t.release_date || undefined,
      }));
      setQueue(q, 0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Playlists & Albums</h1>
        <a className="button" href="/">← Library</a>
      </div>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="card text-red-300">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {collections.map((c) => (
            <button key={c.id} className="card text-left" onClick={() => playCollection(c.id)}>
              {c.artwork ? (
                <img src={c.artwork} alt="artwork" className="h-40 w-full object-cover rounded-lg" />
              ) : (
                <div className="h-40 w-full rounded-lg bg-white/5" />
              )}
              <div className="mt-2 truncate font-medium">{c.name}</div>
              <div className="text-xs text-white/60">{c.isAlbum ? 'Album' : 'Playlist'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
