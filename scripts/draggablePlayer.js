export function initDraggablePlayer(container) {
  container.classList.add("player");
  container.innerHTML = `
    <div class="player__art"><img id="player-art" alt="Cover art" /></div>
    <div class="player__title" id="player-title">Loading…</div>
    <div class="player__progress" id="progress"><div class="player__progress-fill" id="progress-fill"></div></div>
    <div class="player__controls">
      <button class="btn" id="btn-play" aria-label="Play/Pause">Play</button>
      <button class="btn" id="btn-stop" aria-label="Stop">Stop</button>
      <span class="time" id="time">0:00</span>
    </div>
    <audio id="audio" preload="none" crossorigin="anonymous"></audio>
  `;

  const state = {
    audio: container.querySelector('#audio'),
    btnPlay: container.querySelector('#btn-play'),
    btnStop: container.querySelector('#btn-stop'),
    time: container.querySelector('#time'),
    progress: container.querySelector('#progress'),
    progressFill: container.querySelector('#progress-fill'),
    title: container.querySelector('#player-title'),
    artWrap: container.querySelector('.player__art'),
    art: container.querySelector('#player-art'),
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    track: null,
    // Web Audio
    audioCtx: null,
    analyser: null,
    dataArray: null,
    mediaSrc: null,
    // energy bands/beat detection
    bassEMA: 0,
    lastBeat: 0,
  };

  // Hide art until loaded
  state.artWrap.style.display = 'none';

  // Playback controls
  state.btnPlay.addEventListener('click', async () => {
    if (state.audio.src) {
      if (state.audio.paused) {
        try {
          await state.audio.play();
        } catch {}
      } else {
        state.audio.pause();
      }
    }
  });
  state.btnStop.addEventListener('click', () => {
    state.audio.pause();
    state.audio.currentTime = 0;
  });

  function updateTimeUI() {
    const t = Math.floor(state.audio.currentTime || 0);
    const m = Math.floor(t / 60).toString();
    const s = (t % 60).toString().padStart(2, '0');
    state.time.textContent = `${m}:${s}`;
    const d = state.audio.duration || 0;
    const pct = d ? Math.min(100, Math.max(0, (state.audio.currentTime / d) * 100)) : 0;
    state.progressFill.style.width = `${pct}%`;
  }
  state.audio.addEventListener('timeupdate', updateTimeUI);
  state.audio.addEventListener('durationchange', updateTimeUI);
  function ensureAnalyser() {
    try {
      if (!state.audioCtx) {
        const ACtx = window.AudioContext || window.webkitAudioContext;
        if (!ACtx) return; // unsupported
        state.audioCtx = new ACtx();
      }
      if (!state.mediaSrc) {
        state.mediaSrc = state.audioCtx.createMediaElementSource(state.audio);
      }
      if (!state.analyser) {
        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 256; // 128 bins
        state.dataArray = new Uint8Array(state.analyser.frequencyBinCount);
        state.mediaSrc.connect(state.analyser);
        state.analyser.connect(state.audioCtx.destination);
      }
    } catch {}
  }

  state.audio.addEventListener('play', async () => {
    state.btnPlay.textContent = 'Pause';
    ensureAnalyser();
    try { await state.audioCtx?.resume(); } catch {}
  });
  state.audio.addEventListener('pause', () => {
    state.btnPlay.textContent = 'Play';
  });

  // Draggable behavior via Pointer Events
  const onPointerDown = (e) => {
    // only start drag when clicking header/controls area (not while dragging text)
    if (e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('.player__progress')) return;
    state.dragging = true;
    container.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();
    state.offsetX = e.clientX - rect.left;
    state.offsetY = e.clientY - rect.top;
  };
  const onPointerMove = (e) => {
    if (!state.dragging) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    let x = e.clientX - state.offsetX;
    let y = e.clientY - state.offsetY;
    // constrain within viewport
    x = Math.max(8, Math.min(vw - w - 8, x));
    y = Math.max(8, Math.min(vh - h - 8, y));
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
  };
  const onPointerUp = (e) => {
    state.dragging = false;
    if (container.hasPointerCapture?.(e.pointerId)) {
      container.releasePointerCapture(e.pointerId);
    }
    // persist position
    const r = container.getBoundingClientRect();
    try {
      localStorage.setItem('th3scr1b3_player_pos', JSON.stringify({ left: r.left, top: r.top }));
    } catch {}
  };

  // Restore persisted position
  try {
    const saved = JSON.parse(localStorage.getItem('th3scr1b3_player_pos') || 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      // clamp within viewport
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = container.offsetWidth, h = container.offsetHeight;
      const x = Math.max(8, Math.min(vw - w - 8, saved.left));
      const y = Math.max(8, Math.min(vh - h - 8, saved.top));
      container.style.left = `${x}px`;
      container.style.top = `${y}px`;
    }
  } catch {}
  window.addEventListener('resize', () => {
    const r = container.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = container.offsetWidth, h = container.offsetHeight;
    const x = Math.max(8, Math.min(vw - w - 8, r.left));
    const y = Math.max(8, Math.min(vh - h - 8, r.top));
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
  });

  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Progress scrubbing
  let scrubbing = false;
  function seekAt(clientX) {
    const rect = state.progress.getBoundingClientRect();
    const x = Math.min(rect.right, Math.max(rect.left, clientX));
    const ratio = (x - rect.left) / rect.width;
    const d = state.audio.duration || 0;
    if (d) state.audio.currentTime = d * ratio;
  }
  state.progress.addEventListener('pointerdown', (e) => {
    // start only on primary button
    if (e.button !== 0) return;
    scrubbing = true;
    state.progress.setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  });
  state.progress.addEventListener('pointermove', (e) => {
    if (!scrubbing) return;
    // In case some platforms misreport capture, also require button still pressed when mouse
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) return;
    seekAt(e.clientX);
  });
  function endScrub(e){
    if (!scrubbing) return;
    scrubbing = false;
    if (e && state.progress.hasPointerCapture?.(e.pointerId)) state.progress.releasePointerCapture(e.pointerId);
  }
  state.progress.addEventListener('pointerup', endScrub);
  state.progress.addEventListener('pointercancel', endScrub);
  window.addEventListener('pointerup', endScrub);
  window.addEventListener('pointercancel', endScrub);

  function setTrack(info) {
    state.track = info;
    state.title.textContent = info?.title || 'Untitled';

    if (info?.artworkUrl) {
      state.art.src = info.artworkUrl;
      state.art.alt = `Cover art for ${info.title || 'track'}`;
      state.artWrap.style.display = '';
    } else {
      state.art.removeAttribute('src');
      state.artWrap.style.display = 'none';
    }

    if (info?.streamUrl) {
      if (!state.audio.paused) state.audio.pause();
      state.audio.src = info.streamUrl;
      // Autoplay attempt (may be blocked until user interaction)
      state.audio.play().catch(() => {});
    }
  }

  function getAnchorPoint() {
    const r = container.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function getAudio() { return state.audio; }

  function getEnergy() {
    return getEnergyBands().overall;
  }

  function getEnergyBands() {
    const an = state.analyser;
    if (!an || state.audio.paused) return { overall: 0, bass: 0, beat: false };
    try {
      an.getByteFrequencyData(state.dataArray);
      let sum = 0;
      for (let i = 0; i < state.dataArray.length; i++) sum += state.dataArray[i];
      const overall = Math.min(1, Math.max(0, (sum / (state.dataArray.length * 255)) * 1.3));

      // bass band: up to ~200Hz
      const sr = state.audioCtx?.sampleRate || 44100;
      const nyq = sr / 2;
      const binCount = state.dataArray.length;
      const cutoff = 200; // Hz
      let bassIdx = Math.max(4, Math.floor((cutoff / nyq) * binCount));
      bassIdx = Math.min(bassIdx, binCount);
      let bsum = 0;
      for (let i = 0; i < bassIdx; i++) bsum += state.dataArray[i];
      const bass = Math.min(1, Math.max(0, (bsum / (bassIdx * 255)) * 1.4));

      // Beat detection: simple EMA threshold + cooldown
      const now = performance.now();
      const alpha = 0.12; // smoothing factor
      state.bassEMA = state.bassEMA ? (alpha * bass + (1 - alpha) * state.bassEMA) : bass;
      const isBeat = bass > state.bassEMA + 0.12 && (now - state.lastBeat > 200);
      if (isBeat) state.lastBeat = now;

      return { overall, bass, beat: isBeat };
    } catch {
      return { overall: 0, bass: 0, beat: false };
    }
  }

  return { setTrack, getAnchorPoint, getAudio, getEnergy, getEnergyBands, el: container };
}

