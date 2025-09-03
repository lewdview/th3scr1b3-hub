import { initDraggablePlayer } from './draggablePlayer.js';
import { initWaveform } from './waveform.js';
import { initBackdropVis } from './backdropVis.js';
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
        if (t.artworkUrl) updateVisualizerPaletteFromArtwork(t.artworkUrl, t.title||'');
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
