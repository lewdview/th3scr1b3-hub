"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePlayerStore, type Track } from '@/lib/store';
import { getArtworkUrl, getStreamUrl } from '@/lib/audius';
import { Heart } from '@/components/Heart';

const AUDIUS_HANDLE = process.env.NEXT_PUBLIC_AUDIUS_HANDLE || 'th3Scr1b3';

type SortOrder = 'new' | 'old';

type Collection = { id: string; name: string; isAlbum: boolean; artwork?: string };

type Tab = 'tracks' | 'collections' | 'favorites';

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sort, setSort] = useState<SortOrder>('new');
  const [tab, setTab] = useState<Tab>('tracks');
  const [search, setSearch] = useState('');

  const setQueue = usePlayerStore(s => s.setQueue);
  const isFavorite = usePlayerStore(s => s.isFavorite);
  const favorites = usePlayerStore(s => s.favorites);

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
        const [tracksRes, colsRes] = await Promise.all([
          fetch(`/api/audius/tracks?userId=${encodeURIComponent(user.id)}`),
          fetch(`/api/audius/collections?userId=${encodeURIComponent(user.id)}`),
        ]);
        const tracksJson = tracksRes.ok ? await tracksRes.json() : { data: [] };
        const colsJson = colsRes.ok ? await colsRes.json() : { data: [] };
        const rawTracks = tracksJson?.data || [];
        const rawCollections = colsJson?.data || [];
        const mappedTracks: Track[] = rawTracks.map((t: any) => ({
          id: t.id,
          title: t.title,
          streamUrl: getStreamUrl(t.id),
          artwork: getArtworkUrl(t),
          createdAt: t.release_date || undefined,
        }));
        const mappedCollections: Collection[] = rawCollections.map((c: any) => ({
          id: c.id,
          name: c.playlist_name,
          isAlbum: !!c.is_album,
          artwork: getArtworkUrl(c) || undefined,
        }));
        setTracks(mappedTracks);
        setCollections(mappedCollections);
      } catch (e: any) {
        setError(e?.message || 'Failed to load Audius library');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(t => (t.title || '').toLowerCase().includes(q));
  }, [tracks, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sort === 'new' ? bd - ad : ad - bd;
    });
    return arr;
  }, [filtered, sort]);

  const favTracks = useMemo(() => sorted.filter(t => isFavorite(t.id)), [sorted, favorites, isFavorite]);

  const playFrom = (index: number) => {
    const list = tab === 'favorites' ? favTracks : sorted;
    setQueue(list, index);
  };

  const playCollection = async (id: string) => {
    try {
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
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Library</h1>
        {(tab === 'tracks' || tab === 'favorites') && (
          <div className="flex items-center gap-2 text-sm">
            <label className="text-white/70">Sort:</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="bg-[var(--panel)] rounded-xl px-3 py-2 border border-white/10"
            >
              <option value="new">new → old</option>
              <option value="old">old → new</option>
            </select>
            {tab === 'tracks' && (
              <input
                type="search"
                placeholder="Search tracks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[var(--panel)] rounded-xl px-3 py-2 border border-white/10 min-w-[220px]"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className={`button ${tab === 'tracks' ? 'ring-1 ring-white/30' : ''}`} onClick={() => setTab('tracks')}>Tracks</button>
        <button className={`button ${tab === 'collections' ? 'ring-1 ring-white/30' : ''}`} onClick={() => setTab('collections')}>Collections</button>
        <button className={`button ${tab === 'favorites' ? 'ring-1 ring-[rgba(255,0,110,0.6)]' : ''}`} onClick={() => setTab('favorites')}>Favorites</button>
      </div>

      {loading && <div className="card">Loading Audius…</div>}
      {error && <div className="card text-red-300">{error}</div>}

      {!loading && !error && tab === 'tracks' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sorted.map((t, i) => (
            <div key={t.id}>
              <a href={`/t/${t.id}`} className="sr-only">Open track</a>
              <button className="card relative text-left w-full" onClick={() => playFrom(i)}>
                <Heart trackId={t.id} />
                {t.artwork ? (
                  <img src={t.artwork} alt="artwork" className="h-40 w-full object-cover rounded-lg" />
                ) : (
                  <div className="h-40 w-full rounded-lg bg-white/5" />
                )}
                <div className="mt-2 truncate font-medium">{t.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                  {t.createdAt ? <span>{new Date(t.createdAt).toLocaleDateString()}</span> : <span />}
                  <a href={`/t/${t.id}`} className="underline decoration-dotted">Share</a>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'favorites' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {favTracks.map((t, i) => (
            <div key={t.id}>
              <a href={`/t/${t.id}`} className="sr-only">Open track</a>
              <button className="card relative text-left w-full" onClick={() => playFrom(i)}>
                <Heart trackId={t.id} />
                {t.artwork ? (
                  <img src={t.artwork} alt="artwork" className="h-40 w-full object-cover rounded-lg" />
                ) : (
                  <div className="h-40 w-full rounded-lg bg-white/5" />
                )}
                <div className="mt-2 truncate font-medium">{t.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                  {t.createdAt ? <span>{new Date(t.createdAt).toLocaleDateString()}</span> : <span />}
                  <a href={`/t/${t.id}`} className="underline decoration-dotted">Share</a>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'collections' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {collections.map((c) => (
            <div key={c.id}>
              <a href={`/p/${c.id}`} className="sr-only">Open collection</a>
              <button className="card relative text-left w-full" onClick={() => playCollection(c.id)}>
                {c.artwork ? (
                  <img src={c.artwork} alt="artwork" className="h-40 w-full object-cover rounded-lg" />
                ) : (
                  <div className="h-40 w-full rounded-lg bg-white/5" />
                )}
                <div className="mt-2 truncate font-medium">{c.name}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                  <span>{c.isAlbum ? 'Album' : 'Playlist'}</span>
                  <a href={`/p/${c.id}`} className="underline decoration-dotted">Share</a>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
