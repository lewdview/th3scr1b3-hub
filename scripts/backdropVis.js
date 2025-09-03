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
  uniform vec3 u_pa,u_pb,u_pc,u_pd; // palette params

  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t + d)); }

  float line(vec2 uv, float thick) {
    vec2 g = abs(fract(uv - 0.5) - 0.5);
    float d = min(g.x, g.y);
    return smoothstep(thick, thick*0.5, d);
  }

  vec2 warp(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float r = length(p)+1e-4; float a = atan(p.y,p.x);
    float zoom = mix(0.996, 0.972, e); float spin = 0.06 + e*0.28;
    a += spin*t + 0.18*sin(t*0.6 + r*8.0); p = vec2(cos(a),sin(a))*r; p*=zoom; return p+0.5;
  }
  vec2 tunnel(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float r = length(p); float a = atan(p.y,p.x);
    float z = 0.28 + 0.85*e; a += t*0.45 + 0.18*sin(t*1.2 + r*16.0);
    r = pow(r, 0.6 + 0.3*e); p = vec2(cos(a),sin(a))*r*z + 0.5; return p;
  }
  vec2 kaleido(vec2 uv, float t, float e){
    vec2 p = uv-0.5; float a = atan(p.y,p.x); float r = length(p);
    float seg = 5.0 + floor(e*10.0);
    a = mod(a, 6.28318/seg); a = abs(a - 3.14159/seg);
    p = vec2(cos(a),sin(a))*r; float rot = 0.35 + 0.8*e; float c=cos(rot*t), s=sin(rot*t);
    p = mat2(c,-s,s,c)*p; return p*0.96 + 0.5;
  }
  vec2 ripple(vec2 uv, float t, float e){
    vec2 p=uv-0.5; float r=length(p); float w=sin(14.0*r - t*2.8 - e*5.0)*(0.02+0.02*e);
    p += normalize(p)*(w + 0.012*e);
    float rot = 0.08 + 0.3*e; float cs=cos(rot*t), sn=sin(rot*t);
    p = mat2(cs,-sn,sn,cs)*p; return p+0.5;
  }
  vec2 spiral(vec2 uv, float t, float e){
    vec2 p=uv-0.5; float r=length(p)+1e-4; float a=atan(p.y,p.x);
    a += (2.5 + 2.0*e)/r + 0.4*sin(t*0.7);
    p=vec2(cos(a),sin(a))*r*(0.98-0.05*e); return p+0.5;
  }
  vec2 grid(vec2 uv, float t, float e){
    vec2 st = uv*vec2(10.0 + e*18.0, 10.0 + e*14.0);
    st += vec2(t*0.22, t*0.18);
    st = fract(st);
    vec2 p = (st-0.5) * (0.95-0.08*e);
    return p + 0.5;
  }

  void main(){
    float t=u_time; vec2 uv=v_uv; vec2 coord;
    if(u_mode==0){ coord = warp(uv,t,u_energy); }
    else if(u_mode==1){ coord = tunnel(uv,t,u_energy); }
    else if(u_mode==2){ coord = kaleido(uv,t,u_energy); }
    else if(u_mode==3){ coord = ripple(uv,t,u_energy); }
    else if(u_mode==4){ coord = spiral(uv,t,u_energy); }
    else { coord = grid(uv,t,u_energy); }

    vec3 prev = texture(u_prev, coord).rgb;

    // base palette color
    vec2 pc = uv-0.5; float r=length(pc);
    float tt = t*0.25 + u_energy*0.8 + u_bass*0.6;
    vec3 col = pal(r*2.0+tt, u_pa, u_pb, u_pc, u_pd);

    // mode-specific overlays and blending
    float fb = 0.985;
    float colAmt = 0.85;
    if (u_mode==1) { // tunnel: stronger prev decay, radial pulse
      fb = 0.970; colAmt = 0.90;
      col *= 0.8 + 0.2*sin(6.0*r - t*2.0 + u_energy*2.0);
    } else if (u_mode==2) { // kaleido: higher contrast
      fb = 0.980; col = pow(col, vec3(0.8)); colAmt = 0.95;
    } else if (u_mode==3) { // ripple: ring lines
      float ring = smoothstep(0.04, 0.0, abs(sin(18.0*r - t*3.0)))*0.35;
      col += ring;
    } else if (u_mode==4) { // spiral: hue drift with time
      col = pal(r*2.0+tt+0.2*sin(t*0.8), u_pa, u_pb, u_pc, u_pd);
    } else if (u_mode==5) { // grid: crisp grid overlay
      vec2 g = uv*vec2(24.0,24.0) + vec2(t*0.4, t*0.33);
      float gl = line(g, 0.06);
      col = mix(col, vec3(1.0), gl*0.35);
      fb = 0.992; colAmt = 0.80;
    }

    // beat pop
    col += u_beat * 0.18;

    vec3 outc = max(prev*fb, col*colAmt);
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
  const loc_pa = gl.getUniformLocation(prog, 'u_pa');
  const loc_pb = gl.getUniformLocation(prog, 'u_pb');
  const loc_pc = gl.getUniformLocation(prog, 'u_pc');
  const loc_pd = gl.getUniformLocation(prog, 'u_pd');

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
  // palette state (defaults similar to before)
  let pa=[0.45,0.45,0.45];
  let pb=[0.35,0.35,0.35];
  let pc=[1.0,0.9,0.7];
  let pd=[0.0,0.10,0.20];

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
    gl.uniform3f(loc_pa, pa[0], pa[1], pa[2]);
    gl.uniform3f(loc_pb, pb[0], pb[1], pb[2]);
    gl.uniform3f(loc_pc, pc[0], pc[1], pc[2]);
    gl.uniform3f(loc_pd, pd[0], pd[1], pd[2]);

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
  function setMode(m){ mode=((m|0)+6)%6; }
  function nextMode(){ setMode(mode+1); }
  function getMode(){ return mode; }
  function setPalette(a,b,c,d){
    if (a) pa=a; if (b) pb=b; if (c) pc=c; if (d) pd=d;
  }

  resize();
  window.addEventListener('resize', resize);

  return { start, stop, setMode, nextMode, getMode, setPalette, resize, el: canvas };
}
