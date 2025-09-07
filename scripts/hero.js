import { initDraggablePlayer } from './draggablePlayer.js';
import { initWaveform } from './waveform.js';
import { initBackdropVis } from './backdropVis.js';
import { getUserByHandle, getLatestTrackForUserId, getStreamUrlForTrack, getArtworkUrl, getAllTracksForUserId, getAllCollectionsForUserId, getPlaylistById, getTrackById } from './audius.js';

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
  const backdropCanvas = $('backdrop-vis');
  const tracksEl = $('tracks');
  const statsEl = $('stats');
  const statsBgEl = $('stats-bg');

  // Init player
  const player = initDraggablePlayer(playerEl);

  // Backdrop visualizer (created on first play)
  let backdrop;
  let backdropActivated = false;
  let shortcutsBound = false;
  let controlsBound = false;
  let pendingPalette = null;

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

      // Pulse the active nav button glow with audio energy
      try {
        const navActive = document.querySelector('.player__nav .navbtn.is-active');
        if (navActive) {
          const c1 = Math.max(0.15, Math.min(0.9, 0.25 + e * 0.35));
          const blur1 = Math.round(16 + e * 20);
          const blur2 = Math.round(28 + e * 22);
          navActive.style.boxShadow = `inset 0 0 0 1px rgba(0,209,255,0.55), 0 0 ${blur1}px rgba(0,209,255,${c1}), 0 0 ${blur2}px rgba(255,230,0,${0.12 + e * 0.20})`;
        }
      } catch {}

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

  audio.addEventListener('play', () => {
    wf.start();
    canvas.style.opacity = '1';
    // Activate backdrop on first play
    if (!backdropActivated && backdropCanvas) {
      backdrop = initBackdropVis(backdropCanvas, { getEnergyBands: player.getEnergyBands });
      // expose reference for shortcut/controls handler
      try { backdropCanvas.__backdrop_ref = backdrop; } catch {}
      // set initial mode from localStorage
      try {
        const saved = parseInt(localStorage.getItem('th3scr1b3_vis_mode') || '0', 10);
        if (!Number.isNaN(saved)) backdrop.setMode(saved);
      } catch {}
      // apply pending palette if any
      if (pendingPalette && backdrop.setPalette) {
        try { backdrop.setPalette(...pendingPalette); } catch {}
      }
      backdrop.start();
      backdropCanvas.style.opacity = '0.85';
      backdropActivated = true;
      // Bind shortcuts once
      if (!shortcutsBound) {
        bindVisualizerShortcuts();
        shortcutsBound = true;
      }
      // Bind on-screen controls once
      if (!controlsBound) {
        initVisControls(backdrop);
        controlsBound = true;
      }
    } else if (backdrop) {
      backdrop.start();
      backdropCanvas.style.opacity = '0.85';
    }
    startGlowLoop();
  });
  audio.addEventListener('pause', () => {
    wf.stop();
    canvas.style.opacity = '0';
    if (backdrop) {
      // keep faintly visible when paused
      backdrop.stop();
      backdropCanvas.style.opacity = '0.25';
    }
    stopGlowLoop();
  });
  audio.addEventListener('ended', () => {
    wf.stop();
    canvas.style.opacity = '0';
    if (backdrop) {
      backdrop.stop();
      backdropCanvas.style.opacity = '0.15';
    }
    stopGlowLoop();
  });

  // Pause/resume visualizer when tab visibility changes to save battery
  document.addEventListener('visibilitychange', () => {
    try {
      if (!backdrop) return;
      if (document.hidden) {
        backdrop.stop();
        if (backdropCanvas) backdropCanvas.style.opacity = '0.15';
      } else {
        if (!audio.paused) {
          backdrop.start();
          if (backdropCanvas) backdropCanvas.style.opacity = '0.85';
        }
      }
    } catch {}
  });

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
    // Update visualizer palette from latest track artwork
    if (track.artworkUrl) updateVisualizerPaletteFromArtwork(track.artworkUrl, track.title||'');
    latestEl.textContent = `Latest: ${track.title}`;
    latestEl.href = track.permalink || '#';
    latestEl.addEventListener('click', (e) => {
      // allow default link open and also play
      if (track.streamUrl) player.setTrack(track);
    });
    // Autoplay-on-first-gesture fallback if blocked
    ensureAutoplayOnFirstGesture(player.getAudio());
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
  
  // --- Simple hash router: show/hide content sections without reloading ---
  const staticPageIds = ['whoami','web3-agentic','music-art','contact'];
  const pages = staticPageIds.map(id => document.getElementById(id)).filter(Boolean);
  const collectionPage = document.getElementById('collection');
  const collectionTitle = document.getElementById('collection-title');
  const collectionBody = document.getElementById('collection-body');
  const closeBtn = document.getElementById('page-close');

  function parseHash() {
    const raw = (location.hash || '').replace('#','').trim();
    if (!raw) return { kind: 'home' };
    if (staticPageIds.includes(raw)) return { kind: 'page', id: raw };
    const m = raw.match(/^(album|playlist)-(.+)$/);
    if (m) return { kind: 'collection', ctype: m[1], id: m[2] };
    return { kind: 'home' };
  }

  function setActivePageFromState(state) {
    const isStatic = state.kind === 'page';
    const isCollection = state.kind === 'collection';
    if (isStatic || isCollection) document.body.classList.add('page-mode'); else document.body.classList.remove('page-mode');

    // Toggle static pages
    pages.forEach((el) => el?.classList.toggle('is-active', isStatic && el.id === state.id));
    // Toggle collection page
    if (collectionPage) collectionPage.classList.toggle('is-active', isCollection);

    // Update nav highlight
    const navLinks = Array.from(document.querySelectorAll('.player__nav a.navbtn'));
    navLinks.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const target = href.startsWith('#') ? href.slice(1) : '';
      const active = (isStatic && target === state.id);
      a.classList.toggle('is-active', active);
      if (!active) { try { a.style.boxShadow = ''; } catch {} }
    });

    // Scroll to top when entering a page
    if (isStatic || isCollection) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0,0); }
    }

    // Render collection if needed
    if (isCollection) {
      renderCollection(state.ctype, state.id).catch((err) => {
        if (collectionTitle) collectionTitle.textContent = 'COLLECTION';
        if (collectionBody) collectionBody.innerHTML = '<div class="placeholder">Failed to load collection.</div>';
        console.warn('Collection render failed', err);
      });
    }
  }

  async function renderCollection(ctype, id) {
    if (!collectionTitle || !collectionBody) return;
    collectionTitle.textContent = (ctype === 'album') ? 'ALBUM' : 'PLAYLIST';
    collectionBody.innerHTML = '<div class="placeholder">Loading…</div>';
    const pl = await getPlaylistById(id, APP_NAME);
    const title = pl.playlist_name || pl.name || (ctype === 'album' ? 'Album' : 'Playlist');
    if (collectionTitle) collectionTitle.textContent = `${collectionTitle.textContent} — ${title}`;
    // Extract track ids
    const entries = (pl.playlist_contents?.track_ids) || (pl.playlist_contents?.tracks) || [];
    const ids = entries.map(e => e.track_id || e.trackId || e.id).filter(Boolean);
    // Fetch track metadata (limit concurrency)
    const batch = async (arr, n, fn) => {
      const out = []; let i=0;
      while (i < arr.length) {
        const slice = arr.slice(i, i+n);
        const res = await Promise.all(slice.map(fn));
        out.push(...res);
        i += n;
      }
      return out;
    };
    const tracks = await batch(ids, 4, (tid) => getTrackById(tid, APP_NAME).catch(() => null));
    const valid = tracks.filter(Boolean);
    // Render list
    const frag = document.createDocumentFragment();
    valid.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'tile tile--track';
      const art = document.createElement('div'); art.className = 'tile__art';
      const img = document.createElement('img'); img.src = getArtworkUrl(t, '150x150') || getArtworkUrl(t, '480x480') || ''; img.alt = `${t.title||'Track'} cover`; art.appendChild(img);
      const info = document.createElement('div'); info.className = 'tile__info';
      const titleEl = document.createElement('div'); titleEl.className = 'tile__title'; titleEl.textContent = t.title || 'Untitled';
      const meta = document.createElement('div'); meta.className = 'tile__meta'; meta.textContent = 'Track';
      const btn = document.createElement('button'); btn.className = 'tile__play'; btn.textContent = 'Play'; btn.setAttribute('aria-label', `Play ${t.title||'track'}`);
      btn.addEventListener('click', async () => {
        try {
          const url = await getStreamUrlForTrack({ id: t.id || t.track_id || t.trackId }, APP_NAME);
          const artworkUrl = getArtworkUrl(t, '150x150') || getArtworkUrl(t, '480x480') || '';
          player.setTrack({ title: t.title || 'Untitled', streamUrl: url, permalink: t.permalink || '#', artworkUrl });
          if (artworkUrl) updateVisualizerPaletteFromArtwork(artworkUrl, t.title||'');
        } catch (err) { console.warn('Play from collection failed', err); }
      });
      info.appendChild(titleEl); info.appendChild(meta); info.appendChild(btn);
      row.appendChild(art); row.appendChild(info);
      frag.appendChild(row);
    });
    collectionBody.innerHTML = '';
    collectionBody.appendChild(frag);
  }

  function updateRouteFromHash() {
    const state = parseHash();
    setActivePageFromState(state);
  }

  // Intercept clicks on player nav to avoid default jump scrolling
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.player__nav a.navbtn');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const id = href.replace('#','');
    if (staticPageIds.includes(id)) {
      if (location.hash !== `#${id}`) location.hash = `#${id}`;
      else updateRouteFromHash();
    }
  });

  // Close button handler
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      history.pushState('', document.title, window.location.pathname + window.location.search);
      updateRouteFromHash();
    } catch {
      location.hash = '';
    }
  });

  window.addEventListener('hashchange', updateRouteFromHash);

  // Keyboard shortcuts: 'g' then 1..4 to open pages, ESC to close page-mode
  let navChord = false;
  let navChordTimer = 0;
  function resetChord() { navChord = false; clearTimeout(navChordTimer); }
  document.addEventListener('keydown', (e) => {
    if (!e || e.repeat) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    const key = e.key;
    if (key === 'g' || key === 'G') {
      navChord = true;
      clearTimeout(navChordTimer);
      navChordTimer = setTimeout(() => { navChord = false; }, 1800);
      return;
    }
    if (key === 'Escape') {
      // Exit page mode
      try {
        if (document.body.classList.contains('page-mode')) {
          e.preventDefault();
          history.pushState('', document.title, window.location.pathname + window.location.search);
          updateRouteFromHash();
        }
      } catch {
        location.hash = '';
      }
      return;
    }
    if (navChord && (key >= '1' && key <= '4')) {
      const idx = parseInt(key, 10) - 1;
      const id = pageIds[idx];
      if (id) {
        e.preventDefault();
        if (location.hash !== `#${id}`) location.hash = `#${id}`; else updateRouteFromHash();
      }
      resetChord();
    }
  });

  // Initialize on first load
  updateRouteFromHash();
  
});

function ensureAutoplayOnFirstGesture(audioEl) {
  try {
    if (!audioEl) return;
    // If already playing or not paused, nothing to do
    if (!audioEl.paused) return;
    const tryPlay = () => { audioEl.play().catch(() => {}); cleanup(); };
    const cleanup = () => {
      window.removeEventListener('pointerdown', tryPlay);
      window.removeEventListener('keydown', tryPlay);
      window.removeEventListener('touchstart', tryPlay);
    };
    window.addEventListener('pointerdown', tryPlay, { once: true });
    window.addEventListener('keydown', tryPlay, { once: true });
    window.addEventListener('touchstart', tryPlay, { once: true, passive: true });
  } catch {}
}

async function updateVisualizerPaletteFromArtwork(url, seed) {
  // Try to derive palette from artwork; fallback to hash-based
  function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function hslToRgb(h,s,l){
    const a=s*Math.min(l,1-l);
    const f=(n,k=(n+h/30)%12)=>l-a*Math.max(Math.min(k-3,9-k,1),-1);
    return [f(0),f(8),f(4)];
  }
  async function avgColorFromImage(src){
    return new Promise((resolve)=>{
      const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>{
        try{
          const c=document.createElement('canvas'); const ctx=c.getContext('2d');
          const w=24,h=24; c.width=w; c.height=h; ctx.drawImage(img,0,0,w,h);
          const data=ctx.getImageData(0,0,w,h).data; let r=0,g=0,b=0,n=0;
          for(let i=0;i<data.length;i+=4){ const a=data[i+3]; if(a<8) continue; r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
          if(n===0) throw new Error('no pixels');
          resolve([r/n/255,g/n/255,b/n/255]);
        }catch{ resolve(null); }
      };
      img.onerror=()=>resolve(null);
      img.src=src;
    });
  }
  let base = await avgColorFromImage(url);
  if (!base) {
    const h = hashStr(seed||'th3scr1b3') % 360; const s=0.65, l=0.52; base=hslToRgb(h,s,l);
  }
  // derive accent by rotating hue +20deg in HSL
  const toHsl=(r,g,b)=>{
    const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2; if(max===min){ h=0;s=0;} else { const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; default: h=(r-g)/d+4;} h=h*60; } return [h,s,l];
  };
  const toRgb=(h,s,l)=>{ const c=(1-Math.abs(2*l-1))*s; const x=c*(1-Math.abs(((h/60)%2)-1)); const m=l-c/2; let r1=0,g1=0,b1=0; if(h<60){r1=c;g1=x;} else if(h<120){r1=x;g1=c;} else if(h<180){g1=c;b1=x;} else if(h<240){g1=x;b1=c;} else if(h<300){r1=x;b1=c;} else {r1=c;b1=x;} return [r1+m,g1+m,b1+m]; };
  const [hb,sb,lb]=toHsl(base[0],base[1],base[2]);
  const accent=toRgb((hb+35.0), Math.min(0.9,sb+0.1), Math.min(0.75,lb+0.05));

  // Build palette params
  const pa=[0.42,0.42,0.42];
  const pb=[0.34,0.34,0.34];
  const pc=[base[0]*1.1, base[1]*1.1, base[2]*1.1];
  const pd=[accent[0]*0.8, accent[1]*0.8, accent[2]*0.8];

  if (typeof backdrop !== 'undefined' && backdrop && backdrop.setPalette) {
    backdrop.setPalette(pa,pb,pc,pd);
  } else {
    pendingPalette=[pa,pb,pc,pd];
  }
}

function initVisControls(vis) {
  const root = document.getElementById('vis-controls');
  if (!root) return;
  const modeBtns = Array.from(root.querySelectorAll('.vis-controls__mode'));
  const prevBtn = root.querySelector('.vis-controls__btn--prev');
  const nextBtn = root.querySelector('.vis-controls__btn--next');

  const setActive = (mode) => {
    const human = (mode % 6) + 1;
    modeBtns.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.mode) === human));
  };

  // Initialize state
  try { setActive(vis.getMode()); } catch {}

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = (parseInt(btn.dataset.mode, 10) - 1) | 0;
      vis.setMode(m);
      setActive(m);
      try { localStorage.setItem('th3scr1b3_vis_mode', String(m)); } catch {}
      pulseCanvas();
    });
  });

  prevBtn?.addEventListener('click', () => {
    vis.setMode((vis.getMode() - 1 + 6) % 6);
    const m = vis.getMode();
    setActive(m);
    try { localStorage.setItem('th3scr1b3_vis_mode', String(m)); } catch {}
    pulseCanvas();
  });
  nextBtn?.addEventListener('click', () => {
    vis.nextMode();
    const m = vis.getMode();
    setActive(m);
    try { localStorage.setItem('th3scr1b3_vis_mode', String(m)); } catch {}
    pulseCanvas();
  });

  function pulseCanvas() {
    const canvas = document.getElementById('backdrop-vis');
    try {
      canvas.style.transition = 'opacity 120ms ease';
      const prev = canvas.style.opacity || '0.85';
      canvas.style.opacity = '1.0';
      setTimeout(() => { canvas.style.opacity = prev; canvas.style.transition = ''; }, 120);
    } catch {}
  }
}

function bindVisualizerShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (!e || e.repeat) return;
    const active = document.activeElement;
    // Only when focus isn't on an input/textarea/contenteditable
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    const key = e.key.toLowerCase();
    const canvas = document.getElementById('backdrop-vis');
    const vis = canvas && canvas.__backdrop_ref;
    if (!vis) return;
    if (key === 'v') {
      vis.nextMode();
      try { localStorage.setItem('th3scr1b3_vis_mode', String(vis.getMode())); } catch {}
    } else if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5' || key === '6') {
      const mode = (parseInt(key, 10) - 1) | 0;
      vis.setMode(mode);
      try { localStorage.setItem('th3scr1b3_vis_mode', String(mode)); } catch {}
    } else {
      return;
    }
    // Provide a subtle visual confirmation via quick opacity pulse
    try {
      canvas.style.transition = 'opacity 120ms ease';
      const prev = canvas.style.opacity || '0.85';
      canvas.style.opacity = '1.0';
      setTimeout(() => { canvas.style.opacity = prev; canvas.style.transition = ''; }, 120);
    } catch {}
  });
}

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
    const [tracks, collections] = await Promise.all([
      getAllTracksForUserId(userId, APP_NAME),
      getAllCollectionsForUserId(userId, APP_NAME)
    ]);
    if (!tracks.length && !collections.length) {
      container.textContent = 'No media found';
      return;
    }
    const userPic = (user?.profile_picture?.['150x150']) || (user?.profile_picture?.['480x480']) || '';

    // Normalize to a heterogeneous list: many tracks, then one album, then one playlist (if available)
    const trackItems = (tracks || []).map((t) => ({
      type: 'track',
      id: t.id || t.track_id || t.trackId,
      title: t.title || 'Untitled',
      duration: t.duration || t.duration_ms/1000 || null,
      permalink: t.permalink || t.route_id || '#',
      artworkUrl: getArtworkUrl(t, '150x150') || getArtworkUrl(t, '480x480') || userPic
    }));

    const albums = (collections || []).filter(c => !!c.is_album);
    const playlists = (collections || []).filter(c => !c.is_album);
    const pickFirst = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);
    const album = pickFirst(albums);
    const playlist = pickFirst(playlists);

    const normalizeCollection = (c, kind) => c ? ({
      type: kind,
      id: c.playlist_id || c.id,
      title: c.playlist_name || c.name || (kind === 'album' ? 'Album' : 'Playlist'),
      count: c.total_track_count || c.track_count || undefined,
      permalink: c.permalink || '#',
      artworkUrl: getArtworkUrl(c, '150x150') || getArtworkUrl(c, '480x480') || userPic
    }) : null;

    const albumItem = normalizeCollection(album, 'album');
    const playlistItem = normalizeCollection(playlist, 'playlist');

    // Mode and list computation
    const extrasAll = [albumItem, playlistItem].filter(Boolean);

    function getAvailableModes() {
      const modes = ['mixed', 'tracks'];
      if (albumItem) modes.push('album');
      if (playlistItem) modes.push('playlist');
      return modes;
    }

    function normalizeMode(m) {
      const avail = getAvailableModes();
      return avail.includes(m) ? m : 'mixed';
    }

    function computeList(mode) {
      const avail = getAvailableModes();
      const m = normalizeMode(mode);
      if (m === 'tracks') {
        const tracksOnly = [...trackItems];
        shuffle(tracksOnly);
        return tracksOnly;
      }
      if (m === 'album') {
        return albumItem ? [albumItem] : [];
      }
      if (m === 'playlist') {
        return playlistItem ? [playlistItem] : [];
      }
      // mixed default
      const tracksOnly = [...trackItems];
      shuffle(tracksOnly);
      const extras = [albumItem, playlistItem].filter(Boolean);
      return [...tracksOnly, ...extras];
    }

    // Initialize mode from storage
    let mode = 'mixed';
    try { mode = normalizeMode(localStorage.getItem('th3scr1b3_tracks_mode') || 'mixed'); } catch {}

    let list = computeList(mode);

    function buildTiles() {
      // rebuild tiles from current list order
      container.innerHTML = '';
      const frag = document.createDocumentFragment();
      list.forEach((item, idx) => {
        const tile = document.createElement('div');
        const type = item.type || 'track';
        tile.className = `tile tile--${type}`;
        tile.setAttribute('tabindex', '0');
        tile.dataset.index = String(idx);
        tile.dataset.type = type;
        if (item.id) tile.dataset.id = String(item.id);

        const art = document.createElement('div');
        art.className = 'tile__art';
        if (item.artworkUrl) {
          const img = document.createElement('img');
          img.src = item.artworkUrl;
          img.alt = `${item.title} cover`;
          art.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'tile__info';

        const titleEl = document.createElement('div');
        titleEl.className = 'tile__title';
        titleEl.textContent = item.title;

        const meta = document.createElement('div');
        meta.className = 'tile__meta';
        if (type === 'track') {
          meta.textContent = formatTime(item.duration);
        } else {
          const label = type === 'album' ? 'Album' : 'Playlist';
          meta.textContent = `${label}${item.count ? ` • ${item.count} tracks` : ''}`;
        }

        const btn = document.createElement('button');
        btn.className = 'tile__play';
        if (type === 'track') {
          btn.setAttribute('aria-label', `Play ${item.title}`);
          btn.textContent = 'Play';
        } else {
          btn.setAttribute('aria-label', `Open ${item.title}`);
          btn.textContent = 'Open';
        }

        info.appendChild(titleEl);
        info.appendChild(meta);
        info.appendChild(btn);

        tile.appendChild(art);
        tile.appendChild(info);
        frag.appendChild(tile);
      });
      container.appendChild(frag);
      // Ensure playing highlight persists after rebuilds
      updatePlayingClass();
    }

    // Track which item is currently playing (by id)
    let currentPlayingId = null;
    function updatePlayingClass() {
      const tiles = Array.from(container.querySelectorAll('.tile'));
      tiles.forEach((tile) => {
        const id = tile.dataset.id;
        tile.classList.toggle('is-playing', !!currentPlayingId && id && String(id) === String(currentPlayingId));
      });
    }

    // initial render per mode
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
    function updateShuffleVisibility() {
      if (!shuffleBtn) return;
      const hasTracks = list.some(it => it.type === 'track');
      shuffleBtn.style.display = hasTracks ? 'flex' : 'none';
    }
    if (shuffleBtn) {
      updateShuffleVisibility();
      shuffleBtn.onclick = () => {
        // Only shuffle tracks within current list/context
        const tracksOnly = list.filter(it => it.type === 'track');
        if (!tracksOnly.length) return;
        const others = list.filter(it => it.type !== 'track');
        shuffle(tracksOnly);
        // In mixed mode, keep others at the end; in tracks mode there are no others
        list = [...tracksOnly, ...others];
        buildTiles();
        container.scrollTo({ left: 0, behavior: 'smooth' });
        updateNav();
      };
    }

    // Toggle button wiring (cycle modes)
    const toggleBtn = document.getElementById('tracks-toggle');
    function labelFor(mode) {
      if (mode === 'tracks') return 'Tracks';
      if (mode === 'album') return 'Album';
      if (mode === 'playlist') return 'Playlist';
      return 'Mixed';
    }
    function applyMode(newMode) {
      mode = normalizeMode(newMode);
      try { localStorage.setItem('th3scr1b3_tracks_mode', mode); } catch {}
      list = computeList(mode);
      buildTiles();
      updateShuffleVisibility();
      updateNav();
      container.scrollTo({ left: 0, behavior: 'smooth' });
      if (toggleBtn) toggleBtn.textContent = labelFor(mode);
    }
    if (toggleBtn) {
      toggleBtn.style.display = 'flex';
      toggleBtn.textContent = labelFor(mode);
      toggleBtn.onclick = () => {
        const avail = getAvailableModes();
        const i = avail.indexOf(mode);
        const next = avail[(i + 1) % avail.length];
        applyMode(next);
      };
    }

    // Delegate play actions
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.tile__play');
      if (!btn) return;
      const tile = btn.closest('.tile');
      const idx = Number(tile?.dataset.index);
      if (Number.isNaN(idx)) return;
      const item = list[idx];
      const type = item?.type || 'track';
      if (type === 'track') {
        try {
          const streamUrl = await getStreamUrlForTrack({ id: item.id }, APP_NAME);
          player.setTrack({ title: item.title, streamUrl, permalink: item.permalink, artworkUrl: item.artworkUrl });
          if (item.artworkUrl) updateVisualizerPaletteFromArtwork(item.artworkUrl, item.title||'');
          currentPlayingId = item.id || null;
          updatePlayingClass();
        } catch (err) {
          console.warn('Failed to play track', err);
        }
      } else if (type === 'album' || type === 'playlist') {
        // Navigate internally to collection page
        const hash = `${type}-${item.id}`;
        if (location.hash !== `#${hash}`) location.hash = `#${hash}`; else updateRouteFromHash();
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
  // Start continuous spawning without clearing, for smoothness
  renderOnce();
  if (typeof window !== 'undefined') {
    clearInterval(statsCycleTimer);
    // Spawn new rain items every 2 seconds
    statsCycleTimer = setInterval(renderOnce, 2000);
  }
}

function renderStatsBackground(container, user) {
  // Do not clear; append items and remove each when its animation ends for smoothness
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

  // Rainfall: spawn a small batch each tick for continuous motion
  const spawnCount = Math.min(6, Math.max(3, entries.length ? 4 : 0));
  const rainEntries = [];
  for (let i = 0; i < spawnCount; i++) rainEntries.push(entries[(Math.floor(Math.random()*entries.length)) % entries.length]);

  for (let i = 0; i < rainEntries.length; i++) {
    const span = document.createElement('div');
    span.className = 'stats-bg__item stats-bg__item--rain';
    // horizontal position across width (avoid extreme edges)
    const leftPct = 6 + Math.floor(Math.random() * 88); // 6%..94%
    span.style.left = `${leftPct}%`;
    // duration and delay
    const dur = 10 + Math.floor(Math.random() * 6); // 10s..15s smoother
    const delay = Math.random() * 0.8; // small jitter only
    span.style.setProperty('--dur', `${dur}s`);
    span.style.setProperty('--delay', `${delay.toFixed(2)}s`);
    // slight size variance (smaller range)
    const fs = 0.8 + Math.random() * 0.25; // 0.80x..1.05x
    span.style.fontSize = `calc(clamp(0.8rem, 2.2vw, 1.8rem) * ${fs.toFixed(2)})`;
    span.textContent = rainEntries[i];
    // cleanup after animation completes
    span.addEventListener('animationend', () => span.remove());
    container.appendChild(span);
  }
}
