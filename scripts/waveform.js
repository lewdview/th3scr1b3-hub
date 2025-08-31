// Energy waveform renderer: draws pulsing connections between anchors
// Minimal canvas animation with glowing strokes and periodic pulses.

export function initWaveform(canvas, getAnchors, opts = {}) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let raf = null;
  const getEnergy = typeof opts.getEnergy === 'function' ? opts.getEnergy : () => 0;
  const getEnergyBands = typeof opts.getEnergyBands === 'function' ? opts.getEnergyBands : null;
  const DENSITY = Number.isFinite(opts.density) ? opts.density : 2; // higher = more lines
  const SURGE_ORIGINS = Array.isArray(opts.surgeOrigins) ? opts.surgeOrigins : [0];

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }

  const pulses = []; // { t, path: [p0, p1], hue, e }
  const surges = []; // strong beats
  const BASE_INTERVAL = 1000; // ms
  let lastPulse = 0;
  let lastSurge = 0;

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function anchorPairs() {
    const pts = getAnchors();
    const pairs = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) pairs.push([pts[i], pts[j]]);
    }
    return pairs;
  }

  function schedulePulse(now, energy, pair) {
    const pts = pair || (getAnchors().length >= 2 ? null : null);
    if (!pair) {
      const as = getAnchors();
      if (as.length < 2) return;
      const i = Math.floor(Math.random() * as.length);
      let j = Math.floor(Math.random() * as.length);
      if (j === i) j = (j + 1) % as.length;
      pulses.push({ t: now, path: [as[i], as[j]], hue: rand(180, 240), e: energy });
      return;
    }
    pulses.push({ t: now, path: pair, hue: rand(180, 240), e: energy });
  }

  // Neon palettes for cycling gradients
  const PALETTES = [
    ['#00d1ff', '#ffe600', '#29ffb6'], // cyan-yellow-mint
    ['#ff00e6', '#00ffee', '#ffd000'], // magenta-cyan-yellow
    ['#8a5cff', '#00ff9e', '#ffd1ff'], // violet-mint-pink
    ['#00b3ff', '#7cff00', '#ffea00'], // blue-lime-yellow
  ];

  function paletteAt(t) { return PALETTES[Math.floor(t / 2000) % PALETTES.length]; }

  function drawPulse(pulse, now) {
    const life = 1000; // ms
    const dt = now - pulse.t;
    if (dt > life) return false;

    const a = Math.max(0, 1 - dt / life);
    const [p0, p1] = pulse.path;
    const mid = { x: (p0.x + p1.x) / 2 + (Math.random() - 0.5) * 60, y: (p0.y + p1.y) / 2 + (Math.random() - 0.5) * 60 };

    const e = pulse.e;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 1 + 5 * a * (0.3 + 0.7 * e);
    const colors = paletteAt(now);
    const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    grad.addColorStop(0, `${colors[0]}${Math.round(0.1 * a * e * 255).toString(16).padStart(2, '0')}`);
    grad.addColorStop(0.5, `${colors[1]}${Math.round((0.2 + 0.8 * a * e) * 255).toString(16).padStart(2, '0')}`);
    grad.addColorStop(1, `${colors[2]}${Math.round(0.1 * a * e * 255).toString(16).padStart(2, '0')}`);
    ctx.strokeStyle = grad;
    ctx.shadowBlur = 16 + 40 * a * e;
    ctx.shadowColor = colors[1];

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(mid.x, mid.y, p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function drawSurge(surge, now) {
    const life = 420; // fast, punchy
    const dt = now - surge.t;
    if (dt > life) return false;

    const a = Math.max(0, 1 - dt / life);
    const [p0, p1] = surge.path;
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

    const e = Math.max(0.5, surge.e);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3 + 9 * a * e;
    const colors = paletteAt(now + 500);
    const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[2]);
    ctx.strokeStyle = grad;
    ctx.shadowBlur = 40 + 60 * a * e;
    ctx.shadowColor = colors[1];

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(mid.x, mid.y, p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function frame(now) {
    if (!canvas.isConnected) return; // stop if detached
    if (!lastPulse) lastPulse = now;

    const bands = getEnergyBands ? getEnergyBands() : { overall: getEnergy() || 0, bass: 0, beat: false };
    const energy = Math.max(0, Math.min(1, bands.overall || 0));
    const bass = Math.max(0, Math.min(1, bands.bass || 0));
    const beat = !!bands.beat;

    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // schedule pulses only when energy present
    if (energy > 0.05) {
      const interval = BASE_INTERVAL / (0.4 + energy * 3.5); // more energy = many more pulses
      if (now - lastPulse > interval) {
        const pairs = anchorPairs();
        const count = Math.max(1, Math.ceil(DENSITY * (1 + energy * 3)));
        for (let k = 0; k < count; k++) {
          if (pairs.length) {
            const pr = pairs[Math.floor(Math.random() * pairs.length)];
            schedulePulse(now, energy, pr);
          } else {
            schedulePulse(now, energy);
          }
        }
        lastPulse = now;
      }
    }

    // strong bass surge (fan out from the player to others)
    if (beat && now - lastSurge > 180) {
      const pts = getAnchors();
      if (pts.length >= 2) {
        for (const origin of SURGE_ORIGINS) {
          if (origin < 0 || origin >= pts.length) continue;
          for (let idx = 0; idx < pts.length; idx++) {
            if (idx === origin) continue;
            surges.push({ t: now, path: [pts[origin], pts[idx]], hue: 200 + Math.random() * 40, e: bass });
          }
        }
        lastSurge = now;
      }
    }

    // draw all pulses and cull dead ones
    for (let i = pulses.length - 1; i >= 0; i--) {
      if (!drawPulse(pulses[i], now)) pulses.splice(i, 1);
    }
    // Keep a cap to avoid unbounded growth
    if (pulses.length > 300) pulses.splice(0, pulses.length - 300);
    // draw surges
    for (let i = surges.length - 1; i >= 0; i--) {
      if (!drawSurge(surges[i], now)) surges.splice(i, 1);
    }

    raf = requestAnimationFrame(frame);
  }

  function getAnchorPointOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function computeAnchors() {
    // Fallback: if getAnchors provided, use it; else derive from data-anchor elements
    if (typeof getAnchors === 'function') return getAnchors();
    const elements = Array.from(document.querySelectorAll('[data-anchor]'));
    return elements.map(getAnchorPointOf);
  }

  const api = {
    start() {
      resize();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); },
    resize,
  };

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  window.addEventListener('resize', resize);

  // public helper
  api.getAnchors = computeAnchors;

  return api;
}

