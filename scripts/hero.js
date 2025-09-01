import { initDraggablePlayer } from './draggablePlayer.js';
import { initWaveform } from './waveform.js';
import { getUserByHandle, getLatestTrackForUserId, getStreamUrlForTrack, getArtworkUrl, getTracksForUserId, getAllTracksForUserId } from './audius.js';

const APP_NAME = 'th3scr1b3-music-hub';
// Set your Audius handle here. If this handle doesn't exist, the UI will show placeholders.
const AUDIUS_HANDLE = 'th3Scr1b3';

// Globals for stats cycle and beat boost
let statsCycleTimer = null;
let lastStatsBoost = 0;

function $(id) { return document.getElementById(id); }

async function loadLatestTrack(handle) {
  try {
    const user = await getUserByHandle(handle, APP_NAME);
    const userId = user?.id || user?.data?.id;
    if (!userId) throw new Error('User not found');
    const track = await getLatestTrackForUserId(userId, APP_NAME);
    if (!track) throw new Error('No tracks found');
    const streamUrl = await getStreamUrlForTrack(track, APP_NAME);
    const artworkUrl = getArtworkUrl(track, '480x480');
    return { title: track.title || 'Untitled', streamUrl, permalink: track.permalink || track.route_id || '#', artworkUrl };
  } catch (err) {
    console.warn('Audius fetch failed:', err);
    return null;
  }
}

function centerCanvasToContainer(canvas, container) {
  const resize = () => {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  };
  resize();
  window.addEventListener('resize', resize);
}

window.addEventListener('DOMContentLoaded', async () => {
  const playerEl = $('floating-player');
  const brandEl = $('brand');
  const latestEl = $('latest-song');
  const canvas = $('energy-wave');
  const tracksEl = $('tracks');
  const statsEl = $('stats');
  const statsBgEl = $('stats-bg');

  // Init player
  const player = initDraggablePlayer(playerEl);

  // Waveform anchors compute from three elements
  const wf = initWaveform(canvas, () => {
    const p = player.getAnchorPoint();
    const b = brandEl.getBoundingClientRect();
    const l = latestEl.getBoundingClientRect();
    const anchors = [
      p, // index 0: player
      { x: b.left + b.width / 2, y: b.top + b.height / 2 }, // index 1: brand
      { x: l.left + l.width / 2, y: l.top + l.height / 2 }, // index 2: latest
    ];
    // Add ONLY visible carousel tiles to avoid offscreen left anchors
    const tilesAll = Array.from(document.querySelectorAll('.tracks .tile'));
    const visible = tilesAll.filter(t => {
      const r = t.getBoundingClientRect();
      return r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    }).slice(0, 8);
    for (const t of visible) {
      const r = t.getBoundingClientRect();
      anchors.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    return anchors;
  }, { getEnergy: player.getEnergy, getEnergyBands: player.getEnergyBands, density: 2, surgeOrigins: [0, 1] });
  // Do not start until audio is playing

  // Start/stop waveform tied to audio playback
  const audio = player.getAudio();
  let glowRAF;
  function startGlowLoop() {
    cancelAnimationFrame(glowRAF);
    const loop = () => {
      const bands = player.getEnergyBands();
      const e = bands.overall || 0;
      // Smooth values
      const a1 = (0.15 + e * 0.55).toFixed(3);
      const a2 = (0.08 + e * 0.35).toFixed(3);
      brandEl.style.setProperty('--brand-glow1', a1);
      brandEl.style.setProperty('--brand-glow2', a2);

      // Boost background stats a bit on beats
      if (bands.beat && statsBgEl) {
        const now = performance.now();
        if (now - lastStatsBoost > 220) {
          lastStatsBoost = now;
          statsBgEl.classList.add('boost');
          setTimeout(() => statsBgEl.classList.remove('boost'), 160);
        }
      }

      glowRAF = requestAnimationFrame(loop);
    };
    glowRAF = requestAnimationFrame(loop);
  }
  function stopGlowLoop() {
    cancelAnimationFrame(glowRAF);
    brandEl.style.setProperty('--brand-glow1', '0.35');
    brandEl.style.setProperty('--brand-glow2', '0.15');
  }

  audio.addEventListener('play', () => { wf.start(); canvas.style.opacity = '1'; startGlowLoop(); });
  audio.addEventListener('pause', () => { wf.stop(); canvas.style.opacity = '0'; stopGlowLoop(); });
  audio.addEventListener('ended', () => { wf.stop(); canvas.style.opacity = '0'; stopGlowLoop(); });

  // Load user (for stats) in parallel with latest track
  const [userForStats, track] = await Promise.all([
    getUserByHandle(AUDIUS_HANDLE, APP_NAME).catch(() => null),
    loadLatestTrack(AUDIUS_HANDLE)
  ]);

  if (userForStats) {
    // Hide the card and render background floating stats instead
    if (statsEl) statsEl.style.display = 'none';
    if (statsBgEl) {
      startStatsCycle(statsBgEl, userForStats);
    }
  }

  // Load latest track
  if (track) {
    player.setTrack(track);
    latestEl.textContent = `Latest: ${track.title}`;
    latestEl.href = track.permalink || '#';
    latestEl.addEventListener('click', (e) => {
      // allow default link open and also play
      if (track.streamUrl) player.setTrack(track);
    });
  } else {
    // placeholders and helpful messaging
    player.setTrack({ title: `Audius: no tracks found or handle not found (@${AUDIUS_HANDLE})`, streamUrl: '' });
    latestEl.textContent = 'Latest song (unavailable)';
    latestEl.href = '#';
    latestEl.setAttribute('aria-disabled', 'true');
  }

  // Load tracks grid
  await renderTracksGrid(tracksEl, AUDIUS_HANDLE, player);

  // Keep canvas synced to container size
  centerCanvasToContainer(canvas, document.querySelector('.hero'));
  
});

function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}

async function renderTracksGrid(container, handle, player) {
  container.innerHTML = '';
  try {
    const user = await getUserByHandle(handle, APP_NAME);
    const userId = user?.id || user?.data?.id;
    if (!userId) throw new Error('User not found');
    const tracks = await getAllTracksForUserId(userId, APP_NAME);
    if (!tracks.length) {
      container.textContent = 'No tracks found';
      return;
    }
    const userPic = (user?.profile_picture?.['150x150']) || (user?.profile_picture?.['480x480']) || '';
    // Build list and support reshuffle
    let list = tracks.map((t) => ({
      id: t.id || t.track_id || t.trackId,
      title: t.title || 'Untitled',
      duration: t.duration || t.duration_ms/1000 || null,
      permalink: t.permalink || t.route_id || '#',
      artworkUrl: getArtworkUrl(t, '150x150') || getArtworkUrl(t, '480x480') || userPic
    }));

    function buildTiles() {
      // rebuild tiles from current list order
      container.innerHTML = '';
      const frag = document.createDocumentFragment();
      list.forEach((t, idx) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.setAttribute('tabindex', '0');
        tile.dataset.index = String(idx);

        const art = document.createElement('div');
        art.className = 'tile__art';
        if (t.artworkUrl) {
          const img = document.createElement('img');
          img.src = t.artworkUrl;
          img.alt = `${t.title} cover`;
          art.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'tile__info';

        const titleEl = document.createElement('div');
        titleEl.className = 'tile__title';
        titleEl.textContent = t.title;

        const meta = document.createElement('div');
        meta.className = 'tile__meta';
        meta.textContent = formatTime(t.duration);

        const btn = document.createElement('button');
        btn.className = 'tile__play';
        btn.setAttribute('aria-label', `Play ${t.title}`);
        btn.textContent = 'Play';

        info.appendChild(titleEl);
        info.appendChild(meta);
        info.appendChild(btn);

        tile.appendChild(art);
        tile.appendChild(info);
        frag.appendChild(tile);
      });
      container.appendChild(frag);
    }

    // initial random order
    shuffle(list);
    buildTiles();

    // Momentum scrolling & nav
    const leftBtn = document.getElementById('tracks-left');
    const rightBtn = document.getElementById('tracks-right');

    function updateNav() {
      const canScrollLeft = container.scrollLeft > 4;
      const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 4);
      leftBtn.style.display = canScrollLeft ? 'flex' : 'none';
      rightBtn.style.display = canScrollRight ? 'flex' : 'none';
    }
    updateNav();
    container.addEventListener('scroll', updateNav);
    window.addEventListener('resize', updateNav);

    let vx = 0; let rafId = 0;
    function step() {
      if (Math.abs(vx) < 0.1) { rafId = 0; return; }
      container.scrollLeft += vx;
      vx *= 0.92; // friction
      updateNav();
      rafId = requestAnimationFrame(step);
    }
    container.addEventListener('wheel', (e) => {
      // convert vertical wheel to horizontal momentum if needed
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      vx += delta;
      if (!rafId) rafId = requestAnimationFrame(step);
    }, { passive: false });

    leftBtn.onclick = () => {
      container.scrollBy({ left: -container.clientWidth * 0.8, behavior: 'smooth' });
    };
    rightBtn.onclick = () => {
      container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
    };

    // Shuffle button wiring
    const shuffleBtn = document.getElementById('tracks-shuffle');
    if (shuffleBtn) {
      shuffleBtn.style.display = 'flex';
      shuffleBtn.onclick = () => {
        shuffle(list);
        buildTiles();
        container.scrollTo({ left: 0, behavior: 'smooth' });
        updateNav();
      };
    }

    // Delegate play actions
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.tile__play');
      if (!btn) return;
      const tile = btn.closest('.tile');
      const idx = Number(tile?.dataset.index);
      if (Number.isNaN(idx)) return;
      const t = list[idx];
      try {
        const streamUrl = await getStreamUrlForTrack({ id: t.id }, APP_NAME);
        player.setTrack({ title: t.title, streamUrl, permalink: t.permalink, artworkUrl: t.artworkUrl });
      } catch (err) {
        console.warn('Failed to play track', err);
      }
    });
  } catch (err) {
    console.warn('Tracks grid failed:', err);
    container.textContent = 'Tracks unavailable';
  }
}

function addStat(grid, label, value) {
  const row = document.createElement('div');
  row.className = 'stat';
  const l = document.createElement('div'); l.className = 'stat__label'; l.textContent = label;
  const v = document.createElement('div'); v.className = 'stat__value'; v.textContent = value;
  row.appendChild(l); row.appendChild(v);
  grid.appendChild(row);
}

function renderStats(container, user) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'stats__header';
  const handle = document.createElement('div');
  handle.className = 'stats__handle';
  handle.textContent = user.handle || user.name || 'User';
  header.appendChild(handle);
  if (user.is_verified) {
    const badge = document.createElement('span');
    badge.className = 'stats__badge';
    badge.textContent = 'Verified';
    header.appendChild(badge);
  }
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'stats__grid';

  const num = (x) => (x === null || x === undefined) ? '—' : String(x);
  addStat(grid, 'Followers', num(user.follower_count));
  addStat(grid, 'Following', num(user.followee_count));
  addStat(grid, 'Tracks', num(user.track_count));
  addStat(grid, 'Playlists', num(user.playlist_count));
  addStat(grid, 'Albums', num(user.album_count));

  // Socials and misc
  if (user.twitter_handle) addStat(grid, 'Twitter', `@${user.twitter_handle}`);
  if (user.instagram_handle) addStat(grid, 'Instagram', `@${user.instagram_handle}`);
  if (user.tiktok_handle) addStat(grid, 'TikTok', `@${user.tiktok_handle}`);
  if (user.location) addStat(grid, 'Location', user.location);
  if (user.website) addStat(grid, 'Website', user.website);
  if (user.donation) addStat(grid, 'Donation', user.donation);

  container.appendChild(grid);

  // Links
  const links = document.createElement('div');
  links.className = 'stats__links';
  const profileLink = document.createElement('a');
  profileLink.href = user.permalink || '#';
  profileLink.target = '_blank';
  profileLink.rel = 'noopener';
  profileLink.textContent = 'View on Audius';
  links.appendChild(profileLink);
  container.appendChild(links);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startStatsCycle(container, user) {
  const renderOnce = () => {
    renderStatsBackground(container, user);
  };
  renderOnce();
  // Cycle every 10 seconds
  if (typeof window !== 'undefined') {
    clearInterval(statsCycleTimer);
    statsCycleTimer = setInterval(renderOnce, 10000);
  }
}

function renderStatsBackground(container, user) {
  container.innerHTML = '';
  const entries = [];
  const num = (x) => (x === null || x === undefined) ? '—' : String(x);
  if (user.handle) entries.push(`@${user.handle}`);
  if (user.name && user.name.trim() && user.name.trim() !== user.handle) entries.push(user.name.trim());
  entries.push(`${num(user.follower_count)} Followers`);
  entries.push(`${num(user.followee_count)} Following`);
  if (user.track_count !== undefined) entries.push(`${num(user.track_count)} Tracks`);
  if (user.playlist_count !== undefined) entries.push(`${num(user.playlist_count)} Playlists`);
  if (user.album_count !== undefined) entries.push(`${num(user.album_count)} Albums`);
  if (user.location) entries.push(`${user.location}`);
  if (user.twitter_handle) entries.push(`Twitter @${user.twitter_handle}`);
  if (user.instagram_handle) entries.push(`Instagram @${user.instagram_handle}`);
  if (user.tiktok_handle) entries.push(`TikTok @${user.tiktok_handle}`);
  if (user.website) entries.push(`${user.website}`);
  if (user.donation) entries.push(`${user.donation}`);

  // Create a few items and stagger their animation delays
  const maxItems = Math.min(entries.length, 16);
  shuffle(entries);
  for (let i = 0; i < maxItems; i++) {
    const span = document.createElement('div');
    span.className = 'stats-bg__item';
    // staggered delay for both animations (opacity + drift)
    span.style.animationDelay = `${(i % 6) * 1.1}s, ${(i % 6) * 0.6}s`;
    // distribute evenly across nearly full width
    const leftPct = Math.round(((i + 1) * 100) / (maxItems + 1));
    span.style.left = `${leftPct}%`;
    // random amplitude and baseline horizontal offset
    const amp = 6 + Math.floor(Math.random() * 10); // 6px..15px drift
    const dx = -4 + Math.floor(Math.random() * 9);   // -4px..+4px base shift
    span.style.setProperty('--amp', `${amp}px`);
    span.style.setProperty('--dx', `${dx}px`);
    span.style.setProperty('--drift-dur', `${10 + Math.floor(Math.random() * 8)}s`);
    // slight vertical variance along bottom band
    const bottomVh = 3 + Math.floor(Math.random() * 12); // 3vh..14vh
    span.style.bottom = `${bottomVh}vh`;
    span.textContent = entries[i];
    container.appendChild(span);
  }
}
