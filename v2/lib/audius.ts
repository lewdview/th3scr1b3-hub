const DISCOVERY_GATEWAY = "https://api.audius.co";
const FALLBACK_NODE = "https://discovery-provider.audius.co";

async function getDiscoveryNodes(): Promise<string[]> {
  try {
    const res = await fetch(DISCOVERY_GATEWAY, { cache: 'no-store' });
    if (!res.ok) return [FALLBACK_NODE];
    const nodes = await res.json();
    return Array.isArray(nodes) && nodes.length ? nodes : [FALLBACK_NODE];
  } catch {
    return [FALLBACK_NODE];
  }
}

async function requestAudius<T = any>(path: string): Promise<T | null> {
  const nodes = await getDiscoveryNodes();
  const shuffled = [...nodes].sort(() => 0.5 - Math.random());
  for (const base of [...shuffled, FALLBACK_NODE]) {
    try {
      const url = `${base}${path}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // Many Audius endpoints are wrapped in { data }
        return (data?.data ?? data) as T;
      }
    } catch {
      // try next node
    }
  }
  return null;
}

export type AudiusUser = { id: string; handle: string; name: string };
export type AudiusTrack = {
  id: string;
  title: string;
  stream_url: string;
  release_date?: string;
  artwork?: { '1000x1000'?: string; '480x480'?: string; '150x150'?: string } | null;
  user?: AudiusUser;
};

export type AudiusCollection = {
  id: string;
  playlist_name: string;
  is_album: boolean;
  artwork?: { '1000x1000'?: string; '480x480'?: string; '150x150'?: string } | null;
};

export type AudiusPlaylist = {
  id: string;
  playlist_name: string;
  is_album: boolean;
  tracks: AudiusTrack[];
  artwork?: { '1000x1000'?: string; '480x480'?: string; '150x150'?: string } | null;
};

export async function getUserByHandle(handle: string): Promise<AudiusUser | null> {
  // Try exact handle endpoint first
  const direct = await requestAudius<AudiusUser>(`/v1/users/handle/${encodeURIComponent(handle)}?app_name=th3scr1b3-v2`);
  if (direct) return direct;
  // Fallback: search and find exact (case-insensitive) or first candidate
  const candidates = (await requestAudius<AudiusUser[]>(`/v1/users/search?query=${encodeURIComponent(handle)}&limit=5&offset=0&app_name=th3scr1b3-v2`)) ?? [];
  const exact = candidates.find(u => (u.handle || '').toLowerCase() === handle.toLowerCase());
  return exact || candidates[0] || null;
}

export async function getTracksForUserId(userId: string): Promise<AudiusTrack[]> {
  return (await requestAudius<AudiusTrack[]>(`/v1/users/${userId}/tracks?app_name=th3scr1b3-v2`)) ?? [];
}

export async function getCollectionsForUserId(userId: string): Promise<AudiusCollection[]> {
  return (await requestAudius<AudiusCollection[]>(`/v1/users/${userId}/playlists?app_name=th3scr1b3-v2`)) ?? [];
}

export function getArtworkUrl(trackOrCollection: { artwork?: any } | null | undefined): string | undefined {
  const a = trackOrCollection?.artwork;
  return a?.['1000x1000'] || a?.['480x480'] || a?.['150x150'] || undefined;
}

export function getStreamUrl(trackId: string): string {
  // Use local API to allow caching/headers control (server will redirect to Audius)
  return `/api/audius/stream?trackId=${encodeURIComponent(trackId)}`;
}

export async function getPlaylistById(id: string): Promise<AudiusPlaylist | null> {
  return await requestAudius<AudiusPlaylist>(`/v1/playlists/${id}?app_name=th3scr1b3-v2`);
}

export async function getTrackById(id: string): Promise<AudiusTrack | null> {
  return await requestAudius<AudiusTrack>(`/v1/tracks/${id}?app_name=th3scr1b3-v2`);
}
