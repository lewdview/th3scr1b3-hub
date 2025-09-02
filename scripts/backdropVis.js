// Geiss-like WebGL2 feedback visualizer with 3 presets
// Presets: 0=plasma swirl, 1=radial tunnel, 2=kaleidoscope

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
    return { start() {}, stop() {}, setMode() {}, nextMode() {}, getMode() { return 0; }, resize() {}, el: canvas };
  }

  let dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    allocTargets(w, h);
  }

  // Fullscreen quad
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
     1, -1,  1,  1, -1,  1,
  ]), gl.STATIC_DRAW);

  const vsSrc = `#version 300 es
  layout (location=0) in vec2 a_pos;
  out vec2 v_uv;
  void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }
  `;

  const fsSrc = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform sampler2D u_prev;
  uniform float u_time,u_energy,u_bass,u_beat; 
  uniform int u_mode;

  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t + d)); }

  vec2 warp(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float r = length(p)+1e-4; float a = atan(p.y,p.x);
    float zoom = mix(0.996, 0.982, e); float spin = 0.02 + e*0.22;
    a += spin*t + 0.12*sin(t*0.6 + r*6.0); p = vec2(cos(a),sin(a))*r; p*=zoom; return p+0.5;
  }
  vec2 tunnel(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float r = length(p); float a = atan(p.y,p.x);
    float z = 0.35 + 0.65*e; a += t*0.35 + 0.12*sin(t*0.9 + r*12.0);
    r = pow(r, 0.75 + 0.2*e); p = vec2(cos(a),sin(a))*r*z + 0.5; return p;
  }
  vec2 kaleido(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float a = atan(p.y,p.x); float r = length(p);
    float seg = 6.0 + floor(e*6.0);
    a = mod(a, 6.28318/seg); a = abs(a - 3.14159/seg);
    p = vec2(cos(a),sin(a))*r; float rot = 0.15 + 0.6*e; float c=cos(rot*t), s=sin(rot*t);
    p = mat2(c,-s,s,c)*p; return p*0.98 + 0.5;
  }

  void main(){
    float t=u_time; vec2 uv=v_uv; vec2 coord = (u_mode==0)?warp(uv,t,u_energy):((u_mode==1)?tunnel(uv,t,u_energy):kaleido(uv,t,u_energy));
    vec3 prev = texture(u_prev, coord).rgb * 0.985;
    vec2 p = uv-0.5; float r=length(p);
    float tt = t*0.25 + u_energy*0.8 + u_bass*0.6;
    vec3 col = pal(r*2.0+tt, vec3(0.45), vec3(0.35), vec3(1.0,0.9,0.7), vec3(0.0,0.10,0.20));
    col += u_beat*0.18;
    vec3 outc = max(prev*0.98, col*0.85);
    fragColor = vec4(outc,1.0);
  }
  `;

  const prog = buildProgram(gl, vsSrc, fsSrc);
  const loc_prev = gl.getUniformLocation(prog, 'u_prev');
  const loc_time = gl.getUniformLocation(prog, 'u_time');
  const loc_energy = gl.getUniformLocation(prog, 'u_energy');
  const loc_bass = gl.getUniformLocation(prog, 'u_bass');
  const loc_beat = gl.getUniformLocation(prog, 'u_beat');
  const loc_mode = gl.getUniformLocation(prog, 'u_mode');

  let tex = [null,null];
  let fbo = [null,null];
  let cur = 0;

  function allocTargets(w,h){
    for (let i=0;i<2;i++){ if(fbo[i]) gl.deleteFramebuffer(fbo[i]); if(tex[i]) gl.deleteTexture(tex[i]); }
    for (let i=0;i<2;i++){
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      tex[i]=t; fbo[i]=f;
    }
    cur = 0;
  }

  function buildProgram(gl, vs, fs){
    const v=gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v,vs); gl.compileShader(v); if(!gl.getShaderParameter(v,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(v));
    const f=gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f,fs); gl.compileShader(f); if(!gl.getShaderParameter(f,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(f));
    const p=gl.createProgram(); gl.attachShader(p,v); gl.attachShader(p,f); gl.bindAttribLocation(p,0,'a_pos'); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); gl.deleteShader(v); gl.deleteShader(f); return p;
  }

  let mode=0, running=false, startTs=0, raf=0;

  function draw(dstFbo, srcTex){
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);

    const bands = getEnergyBands?.() || { overall:0, bass:0, beat:false };
    const e = Math.min(1.0, Math.max(0.0, bands.overall||0));
    const b = Math.min(1.0, Math.max(0.0, bands.bass||0));
    const beat = bands.beat ? 1.0 : 0.0;

    const t = (performance.now()-startTs)*0.001;
    gl.uniform1i(loc_prev, 0);
    gl.uniform1f(loc_time, t);
    gl.uniform1f(loc_energy, e);
    gl.uniform1f(loc_bass, b);
    gl.uniform1f(loc_beat, beat);
    gl.uniform1i(loc_mode, mode);

    gl.drawArrays(gl.TRIANGLES,0,6);
  }

  function step(){
    draw(fbo[1-cur], tex[cur]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    draw(null, tex[1-cur]);
    cur = 1-cur;
    raf = requestAnimationFrame(step);
  }

  function start(){ if(running) return; running=true; startTs=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(step); }
  function stop(){ running=false; cancelAnimationFrame(raf); }
  function setMode(m){ mode=((m|0)+3)%3; }
  function nextMode(){ setMode(mode+1); }
  function getMode(){ return mode; }

  resize();
  window.addEventListener('resize', resize);

  return { start, stop, setMode, nextMode, getMode, resize, el: canvas };
}
