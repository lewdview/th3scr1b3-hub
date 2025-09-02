// GUI-less backdrop visualizer using 2D canvas particles
// Drives intensity from getEnergyBands() provided by the player

export function initBackdropVis(canvas, { getEnergyBands }) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, raf = 0, running = false;
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.floor(rect.width);
    h = Math.floor(rect.height);
    canvas.width = Math.max(1, Math.floor(w * DPR));
    canvas.height = Math.max(1, Math.floor(h * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Modes: 0=particles, 1=blooms, 2=bars
  let mode = 0;

  // Particles (mode 0)
  const P_COUNT = 120;
  let particles = Array.from({ length: P_COUNT }, () => pSpawn(true));
  function pSpawn(init = false) {
    const x = Math.random() * w;
    const y = init ? Math.random() * h : (Math.random() < 0.5 ? -20 : h + 20);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;
    const r = 3 + Math.random() * 10;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, life: 0 };
  }

  // Blooms (mode 1)
  let blooms = [];
  function bSpawn(x, y, e, big = false) {
    const maxR = (big ? 260 : 140) * (0.6 + e * 0.8);
    const hue = 180 + e * 150;
    const speed = 1.2 + Math.random() * 0.8;
    blooms.push({ x, y, r: 0, maxR, hue, life: 0, speed });
  }

  // Bars (mode 2)
  const BAR_COUNT = 48;
  let t = 0;

  function hueForEnergy(e) {
    // 180..330 (cyan -> magenta) blended with yellow on peaks
    const base = 180 + e * 150;
    return base;
  }

  function drawParticles(e) {
    // Fade the canvas to create trails
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(10,12,16,${0.06 + e * 0.04})`;
    ctx.fillRect(0, 0, w, h);

    // Additive draw for glow
    ctx.globalCompositeOperation = 'lighter';
    const hue = hueForEnergy(e);
    const amp = 0.8 + e * 3.2; // motion boost

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * amp;
      p.y += p.vy * amp;
      p.vx *= 0.998; p.vy *= 0.998;
      p.life += 1;
      if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40 || p.life > 1200) {
        particles[i] = pSpawn();
        continue;
      }
      const rr = p.r * (0.7 + e * 0.6);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      const c1 = `hsla(${hue}, 95%, ${65 + e * 20}%, ${0.18 + e * 0.18})`;
      const c2 = `hsla(${(hue + 40) % 360}, 100%, ${55 + e * 25}%, 0)`;
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBlooms(e, beat) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(10,12,16,${0.08 + e * 0.05})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // Spawn center-ish blooms; more on beats
    if (Math.random() < 0.25 + e * 0.35) bSpawn(Math.random() * w, Math.random() * h, e, false);
    if (beat) {
      for (let i = 0; i < 2; i++) bSpawn(Math.random() * w, Math.random() * h, Math.min(1, e + 0.2), true);
    }

    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i];
      b.r += b.speed * (1.2 + e * 2.5);
      b.life += 1;
      const alpha = Math.max(0, 0.24 - (b.r / b.maxR) * 0.24);
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(1, b.r));
      const c1 = `hsla(${b.hue}, 95%, ${60 + e * 25}%, ${alpha})`;
      const c2 = `hsla(${(b.hue + 50) % 360}, 95%, ${55 + e * 25}%, 0)`;
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1, b.r), 0, Math.PI * 2); ctx.fill();
      if (b.r >= b.maxR) blooms.splice(i, 1);
    }
  }

  function drawBars(e, bass) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(10,12,16,${0.12})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    const hue = hueForEnergy(e);
    const barW = Math.max(2, Math.floor(w / BAR_COUNT));
    t += 0.003 + e * 0.01;
    for (let i = 0; i < BAR_COUNT; i++) {
      const x = i * barW + barW * 0.15;
      const n = Math.sin(t * 6 + i * 0.5) * 0.5 + 0.5; // 0..1
      const height = (0.12 + e * 0.68) * h * (0.6 + n * 0.8) * (0.7 + bass * 0.6);
      const y = h - height - 2;
      const grad = ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, `hsla(${(hue + 20) % 360}, 95%, ${65 + e * 20}%, ${0.35 + e * 0.25})`);
      grad.addColorStop(1, `hsla(${(hue + 80) % 360}, 95%, ${55 + e * 20}%, 0)`);
      ctx.fillStyle = grad;
      const radius = Math.min(6, barW * 0.4);
      // rounded rect
      const rw = barW * 0.7;
      roundRect(ctx, x, y, rw, height, radius);
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function step() {
    const bands = getEnergyBands?.() || { overall: 0, bass: 0, beat: false };
    const e = Math.max(0, Math.min(1, bands.overall || 0));

    if (mode === 0) {
      drawParticles(e);
    } else if (mode === 1) {
      drawBlooms(e, !!bands.beat);
    } else {
      drawBars(e, Math.max(0, Math.min(1, bands.bass || 0)));
    }

    raf = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function setMode(m) {
    mode = ((m | 0) + 3) % 3;
    // reset buffers for a clean transition
    particles = Array.from({ length: P_COUNT }, () => pSpawn(true));
    blooms = [];
    t = 0;
  }
  function nextMode() { setMode(mode + 1); }
  function getMode() { return mode; }

  return { start, stop, resize, el: canvas, setMode, nextMode, getMode };
}

