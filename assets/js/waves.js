/* Animated wave/mesh background (canvas).
   Target look: a dense “ribbon” made of many parallel lines (like the reference video).
   Lightweight, dependency-free, GitHub Pages friendly.
*/

(function(){
  const canvas = document.getElementById('bg');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#E34234';

  const state = {
    t: 0,
    dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    w: 0,
    h: 0,
    lastStampMs: 0,
    stamps: [],
  };

  function resize(){
    state.w = Math.floor(window.innerWidth);
    state.h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = state.w + 'px';
    canvas.style.height = state.h + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // Lightweight 1D value-noise (deterministic, smooth). No deps.
  function hash1(n){
    const x = Math.sin(n * 127.1) * 43758.5453123;
    return x - Math.floor(x);
  }
  function fade(t){ return t * t * (3 - 2 * t); }
  function lerp(a,b,t){ return a + (b-a) * t; }
  function noise1(x){
    const i0 = Math.floor(x);
    const i1 = i0 + 1;
    const t = x - i0;
    const a = hash1(i0);
    const b = hash1(i1);
    return lerp(a, b, fade(t)) * 2 - 1; // [-1,1]
  }
  function fbm(x, t){
    let v = 0;
    let amp = 0.55;
    let f = 1.0;
    v += amp * noise1(x * f + t * 0.9);
    amp *= 0.5; f *= 2.1;
    v += amp * noise1(x * f - t * 0.55);
    amp *= 0.5; f *= 2.0;
    v += amp * noise1(x * f + t * 0.35);
    return v;
  }

  // Build a single wave polyline in a “virtual” (rotated) canvas.
  // Returns an array of [x,y] points.
  function buildWavePath(VW, VH, y, amp, phase, speed){
    const steps = 360;
    const pts = new Array(steps + 1);
    for(let i=0;i<=steps;i++){
      const x = (i/steps) * VW;
      const nx = (x / VW) * 6.6;
      const base = fbm(nx + phase, state.t * speed);
      const twirl = fbm(nx * 1.7 + phase, state.t * (speed*1.25)) * 0.35;
      const yy = y + (base + twirl) * amp;
      pts[i] = [x, yy];
    }
    return pts;
  }

  function strokePath(pts, style){
    ctx.save();
    ctx.beginPath();
    for(let i=0;i<pts.length;i++){
      const p = pts[i];
      if(i===0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.globalAlpha = style.alpha;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = 'round';
    if(style.shadow){
      ctx.shadowColor = style.shadow.color;
      ctx.shadowBlur = style.shadow.blur;
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPaperNoise(){
    const W = state.w;
    const H = state.h;
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.030;
    const step = 6;
    const tick = Math.floor(state.t*12);
    for(let y=0;y<H;y+=step){
      for(let x=0;x<W;x+=step){
        const n = hash1((x*0.13 + y*0.71) + tick);
        if(n > 0.92) ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }

  function frame(){
    state.t += 0.0105;

    // Clear + redraw stored imprints (static).
    ctx.clearRect(0,0,state.w,state.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,state.w,state.h);

    const now = performance.now();
    if(state.lastStampMs === 0) state.lastStampMs = now;

    // Requested tilt: 30°
    const ang = 30 * Math.PI / 180;

    // Virtual canvas that fully covers the viewport after rotation.
    const VW = Math.hypot(state.w, state.h);
    const VH = VW;
    const y = VH * 0.55;
    const amp = 58;
    const phase = 1.3;
    const speed = 0.75;

    const livePath = buildWavePath(VW, VH, y, amp, phase, speed);

    // Every second, store a grey “imprint” where the line was.
    if(now - state.lastStampMs >= 1000){
      state.stamps.push(livePath);
      state.lastStampMs = now;
      // Keep at most ~90 seconds of imprints.
      if(state.stamps.length > 90) state.stamps.shift();
    }

    // Draw in rotated coordinates.
    ctx.save();
    ctx.translate(state.w/2, state.h/2);
    ctx.rotate(ang);
    ctx.translate(-VW/2, -VH/2);

    // Grey static imprints
    for(const pts of state.stamps){
      strokePath(pts, {
        color: '#111111',
        alpha: 0.055,
        width: 1.1,
      });
    }

    // One single red line (live)
    strokePath(livePath, {
      color: accent,
      alpha: 0.92,
      width: 2.2,
      shadow: { color: accent, blur: 14 },
    });

    ctx.restore();

    drawPaperNoise();

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize, {passive:true});
  resize();
  requestAnimationFrame(frame);
})();
