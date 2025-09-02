// Geiss-like WebGL2 feedback visualizer with 3 presets
// Presets: 0=plasma swirl, 1=radial tunnel, 2=kaleidoscope bars

export function initBackdropVis(canvas, { getEnergyBands }) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false
  });
  if (!gl) {
    // Fallback: no-op visualizer to avoid breaking the app
    return {
      start() {}, stop() {}, setMode() {}, nextMode() {}, getMode() { return 0; }, resize() {}, el: canvas
    };
  }

  let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // (Re)allocate ping-pong targets
    allocTargets();
  }

  // Quad setup
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  // clipspace quad covering screen
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
     1, -1,  1,  1, -1,  1,
  ]), gl.STATIC_DRAW);

  // Shader sources
  const vsSrc = `#version 300 es
  layout (location=0) in vec2 a_pos;
  out vec2 v_uv;
  void main(){
    v_uv = a_pos*0.5+0.5;
    gl_Position = vec4(a_pos,0.0,1.0);
  }
  `;

  const fsSrc = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform sampler2D u_prev;
  uniform vec2 u_res;
  uniform float u_time;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_beat;
  uniform int u_mode;

  // palette helper
  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){
    return a + b*cos(6.28318*(c*t + d));
  }

  // warp function used for all modes
  vec2 warp(vec2 uv, float t, float e){
    vec2 p = uv - 0.5;
    float r = length(p)+1e-5;
    float ang = atan(p.y, p.x);
    // energy drives zoom/rotation
    float zoom = mix(0.996, 0.982, e);
    float spin = 0.02 + e*0.22;
    ang += spin * t + 0.12*sin(t*0.6 + r*6.0);
    p = vec2(cos(ang), sin(ang)) * r;
    p *= zoom;
    return p + 0.5;
  }

  vec2 tunnel(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float r = length(p); float a = atan(p.y,p.x);
    float z = 0.35 + 0.65*e;
    a += t*0.35 + 0.12*sin(t*0.9 + r*12.0);
    r = pow(r, 0.75 + 0.2*e);
    p = vec2(cos(a), sin(a))*r*z + 0.5;
    return p;
  }

  vec2 kaleido(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float a = atan(p.y,p.x); float r = length(p);
    float seg = 6.0 + floor(e*6.0);
    a = mod(a, 6.28318/seg);
    a = abs(a - 3.14159/seg);
    p = vec2(cos(a), sin(a))*r;
    float rot = 0.15 + 0.6*e;
    float c = cos(rot*t), s = sin(rot*t);
    p = mat2(c,-s,s,c)*p;
    return p*0.98 + 0.5;
  }

  void main(){
    float t = u_time;
    vec2 uv = v_uv;
    vec2 coord;
    if(u_mode==0){
      coord = warp(uv, t, u_energy);
    } else if(u_mode==1){
      coord = tunnel(uv, t, u_energy);
    } else {
      coord = kaleido(uv, t, u_energy);
    }

    // feedback sample
    vec3 prev = texture(u_prev, coord).rgb * 0.985;

    // overlay color layer
    vec2 p = uv - 0.5; float r = length(p);
    float tt = t*0.25 + u_energy*0.8 + u_bass*0.6;
    vec3 col = pal(r*2.0 + tt,
      vec3(0.45,0.45,0.45),
      vec3(0.35,0.35,0.35),
      vec3(1.0, 0.9, 0.7),
      vec3(0.0, 0.10, 0.20)
    );
    // boost on beats
    col += u_beat * 0.18;

    // blend
    vec3 outc = max(prev*0.98, col*0.85);
    fragColor = vec4(outc, 1.0);
  }
  `;

  const prog = buildProgram(gl, vsSrc, fsSrc);
  const loc = {
    a_pos: 0,
    u_prev: gl.getUniformLocation(prog, 'u_prev'),
    u_res: gl.getUniformLocation(prog, 'u_res'),
    u_time: gl.getUniformLocation(prog, 'u_time'),
    u_energy: gl.getUniformLocation(prog, 'u_energy'),
    u_bass: gl.getUniformLocation(prog, 'u_bass'),
    u_beat: gl.getUniformLocation(prog, 'u_beat'),
    u_mode: gl.getUniformLocation(prog, 'u_mode'),
  };

  // targets
  let tex = [null, null];
  let fb = [null, null];
  let cur = 0;

  function makeTarget() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f };
  }

  function allocTargets(){
    // delete old
    for (let i=0;i<2;i++){
      if (fb[i]) gl.deleteFramebuffer(fb[i]);
      if (tex[i]) gl.deleteTexture(tex[i]);
    }
    const a = makeTarget(); const b = makeTarget();
    tex[0]=a.t; fb[0]=a.f; tex[1]=b.t; fb[1]=b.f;
    cur = 0;
  }

  function buildProgram(gl, vs, fs){
    const v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, vs); gl.compileShader(v);
    if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(v));
    const f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, fs); gl.compileShader(f);
    if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(f));
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.deleteShader(v); gl.deleteShader(f);
    return p;
  }

  // state
  let mode = 0;
  let running = false;
  let startTs = 0;
  let raf = 0;

  function drawTo(targetFbo, srcTex){
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);

    const bands = getEnergyBands?.() || { overall: 0, bass: 0, beat: false };
    const e = Math.max(0.0, Math.min(1.0, bands.overall || 0));
    const b = Math.max(0.0, Math.min(1.0, bands.bass || 0));
    const beat = bands.beat ? 1.0 : 0.0;

    const t = (performance.now() - startTs) * 0.001;
    gl.uniform1i(loc.u_prev, 0);
    gl.uniform2f(loc.u_res, canvas.width, canvas.height);
    gl.uniform1f(loc.u_time, t);
    gl.uniform1f(loc.u_energy, e);
    gl.uniform1f(loc.u_bass, b);
    gl.uniform1f(loc.u_beat, beat);
    gl.uniform1i(loc.u_mode, mode);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function step(){
    // ping-pong: src is tex[cur], dst is tex[1-cur]
    const src = tex[cur];
    const dst = fb[1 - cur];
    drawTo(dst, src);

    // present to screen by sampling the freshly rendered tex
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    drawTo(null, tex[1 - cur]);

    cur = 1 - cur;
    raf = requestAnimationFrame(step);
  }

  function start(){
    if (running) return;
    running = true;
    startTs = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }
  function stop(){ running = false; cancelAnimationFrame(raf); }
  function setMode(m){ mode = ((m|0)+3)%3; }
  function nextMode(){ setMode(mode+1); }
  function getMode(){ return mode; }

  resize();
  window.addEventListener('resize', resize);

  return { start, stop, setMode, nextMode, getMode, resize, el: canvas };
}
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

