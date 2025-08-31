// Lightweight Audius API helper (no external deps)
// Note: Set your handle in hero.js; this module focuses on discovery and track resolution.

const DISCOVERY_GATEWAY = "https://api.audius.co";

async function pickDiscoveryNode() {
  const res = await fetch(DISCOVERY_GATEWAY);
  if (!res.ok) throw new Error(`Audius discovery error: ${res.status}`);
  const data = await res.json();
  const nodes = data?.data || data;
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error("No Audius discovery nodes available");
  return nodes[Math.floor(Math.random() * nodes.length)];
}

async function searchUsers(query, appName) {
  const base = await pickDiscoveryNode();
  const url = `${base}/v1/users/search?query=${encodeURIComponent(query)}&app_name=${encodeURIComponent(appName)}&limit=5&offset=0`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data || [];
}

export async function getUserByHandle(handle, appName) {
  const base = await pickDiscoveryNode();
  const url = `${base}/v1/users/handle/${encodeURIComponent(handle)}?app_name=${encodeURIComponent(appName)}`;
  let res = await fetch(url);
  if (res.status === 404) {
    // Fallback to search
    const candidates = await searchUsers(handle, appName);
    const exact = candidates.find(u => (u.handle || '').toLowerCase() === handle.toLowerCase());
    return exact || candidates[0] || null;
  }
  if (!res.ok) throw new Error(`Audius user lookup failed: ${res.status}`);
  const json = await res.json();
  return json?.data || json;
}

export async function getLatestTrackForUserId(userId, appName) {
  // Request without sort to avoid 400 from some nodes
  let base = await pickDiscoveryNode();
  let url = `${base}/v1/users/${encodeURIComponent(userId)}/tracks?app_name=${encodeURIComponent(appName)}&limit=1`;
  let res = await fetch(url);
  if (!res.ok) {
    // try another node
    base = await pickDiscoveryNode();
    url = `${base}/v1/users/${encodeURIComponent(userId)}/tracks?app_name=${encodeURIComponent(appName)}&limit=1`;
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`Audius tracks fetch failed: ${res.status}`);
  const json = await res.json();
  const tracks = json?.data || json;
  return Array.isArray(tracks) ? tracks[0] : null;
}

export async function getTracksForUserId(userId, appName, limit = 12) {
  // Request without sort to avoid 400 from some nodes
  let base = await pickDiscoveryNode();
  let url = `${base}/v1/users/${encodeURIComponent(userId)}/tracks?app_name=${encodeURIComponent(appName)}&limit=${encodeURIComponent(limit)}`;
  let res = await fetch(url);
  if (!res.ok) {
    // try another node
    base = await pickDiscoveryNode();
    url = `${base}/v1/users/${encodeURIComponent(userId)}/tracks?app_name=${encodeURIComponent(appName)}&limit=${encodeURIComponent(limit)}`;
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`Audius tracks fetch failed: ${res.status}`);
  const json = await res.json();
  const tracks = json?.data || json;
  return Array.isArray(tracks) ? tracks : [];
}

export async function getStreamUrlForTrack(track, appName) {
  const base = await pickDiscoveryNode();
  // Some responses include stream_url; otherwise we build from id
  if (track?.stream_url) {
    const hasQuery = track.stream_url.includes("?");
    return `${track.stream_url}${hasQuery ? "&" : "?"}app_name=${encodeURIComponent(appName)}`;
  }
  const id = track?.id || track?.track_id || track?.trackId;
  if (!id) throw new Error("Track id missing for stream URL");
  return `${base}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${encodeURIComponent(appName)}`;
}

export function getArtworkUrl(track, size = '480x480') {
  if (!track) return '';
  // Common shapes from Audius discovery API
  // Prefer artwork object with sizes, fall back to generic fields
  const art = track.artwork || track.cover_art || track.thumbnail || {};
  const sized = art && typeof art === 'object' ? (art[size] || art['1000x1000'] || art['480x480'] || art['150x150']) : '';
  const direct = track.artwork_url || track.artworkUrl || track.cover_art_sizes || track['artwork'];
  return sized || direct || '';
}

