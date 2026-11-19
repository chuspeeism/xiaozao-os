// Canvas-based shader-like effects.
// Each factory returns { canvas, destroy } and runs on requestAnimationFrame.
// All effects are monochrome by design.

(function(){
  'use strict';

  function rAF(loop){
    let raf, t0 = performance.now();
    const tick = (t) => {
      loop((t - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  // --- 1. Halftone Eye -----------------------------------------------------
  // Halftone field: dot sizes vary by a procedural "field" + vignette
  // to suggest a dithered eye / portrait.
  function halftonePortrait(opts = {}){
    const w = opts.w || 900, h = opts.h || 1200;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const cell = opts.cell || 10;
    const stop = rAF((t) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += cell){
        for (let x = 0; x < w; x += cell){
          const nx = (x/w - 0.5), ny = (y/h - 0.5);
          // "eye" field: concentric ellipse + sinusoidal iris
          const r = Math.sqrt(nx*nx + ny*ny*0.9);
          const iris = Math.exp(-Math.pow((r-0.08)/0.05, 2));
          const pupil = Math.exp(-Math.pow(r/0.04, 2));
          const lid = Math.max(0, 1 - Math.pow(Math.abs(ny)/0.35, 2.2));
          const noise = 0.5 + 0.5 * Math.sin(x*0.013 + y*0.021 + t*0.3)
                              * Math.cos(x*0.007 - y*0.011 - t*0.2);
          let v = lid * (0.6 + 0.45*iris - 0.9*pupil) + 0.08*noise;
          v = Math.max(0, Math.min(1, v));
          // dot size from darkness (invert)
          const d = (1 - v) * cell * 0.92;
          if (d < 0.4) continue;
          ctx.beginPath();
          ctx.arc(x + cell/2, y + cell/2, d/2, 0, Math.PI*2);
          ctx.fill();
        }
      }
    });
    return { canvas, destroy: stop };
  }

  // --- 2. Ordered dither gradient -----------------------------------------
  // Bayer 8x8 threshold against a procedural gradient field.
  const BAYER8 = (function(){
    const b = [
      0,48,12,60, 3,51,15,63,
      32,16,44,28,35,19,47,31,
      8,56, 4,52,11,59, 7,55,
      40,24,36,20,43,27,39,23,
      2,50,14,62, 1,49,13,61,
      34,18,46,30,33,17,45,29,
      10,58, 6,54, 9,57, 5,53,
      42,26,38,22,41,25,37,21
    ];
    return b.map(v => (v+0.5)/64);
  })();

  function orderedDither(opts = {}){
    const w = opts.w || 900, h = opts.h || 1200;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const stop = rAF((t) => {
      for (let y = 0; y < h; y++){
        for (let x = 0; x < w; x++){
          const nx = x/w, ny = y/h;
          // sweeping gradient + orb
          const cx = 0.5 + 0.3*Math.sin(t*0.4);
          const cy = 0.5 + 0.2*Math.cos(t*0.3);
          const d = Math.hypot(nx-cx, ny-cy);
          let v = Math.max(0, 1 - d*1.4);
          v = v * 0.9 + 0.1*Math.sin((nx+ny)*8 + t);
          const thr = BAYER8[(y%8)*8 + (x%8)];
          const bit = v > thr ? 255 : 0;
          const i = (y*w + x)*4;
          data[i] = data[i+1] = data[i+2] = bit; data[i+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    });
    return { canvas, destroy: stop };
  }

  // --- 3. Dot field / particle burst --------------------------------------
  function dotField(opts = {}){
    const w = opts.w || 900, h = opts.h || 900;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const rings = opts.rings || 9;
    const perRing = opts.perRing || 36;
    const stop = rAF((t) => {
      ctx.fillStyle = opts.bg || '#000';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = opts.fg || '#fff';
      const cx = w/2, cy = h/2;
      for (let r = 1; r <= rings; r++){
        const radius = (r / rings) * (Math.min(w,h)*0.46);
        const count = Math.floor(perRing * (r/rings));
        for (let i = 0; i < count; i++){
          const a = (i/count) * Math.PI*2 + t*0.05*(r%2?1:-1);
          const jitter = Math.sin(t*0.7 + r*1.3 + i*0.6);
          const rad = radius + jitter*3;
          const x = cx + Math.cos(a)*rad;
          const y = cy + Math.sin(a)*rad;
          const size = 2 + (r/rings)*2.5 + Math.max(0, Math.sin(t*2 + i + r))*1.5;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI*2);
          ctx.fill();
        }
      }
    });
    return { canvas, destroy: stop };
  }

  // --- 4. Noise field (perlin-ish) -----------------------------------------
  function noiseField(opts = {}){
    const w = opts.w || 900, h = opts.h || 600;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;
    function hash(x,y){
      const s = Math.sin(x*127.1 + y*311.7)*43758.5453;
      return s - Math.floor(s);
    }
    function vnoise(x,y){
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x-xi, yf = y-yi;
      const a = hash(xi,yi), b = hash(xi+1,yi),
            c = hash(xi,yi+1), d = hash(xi+1,yi+1);
      const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
      return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
    }
    const stop = rAF((t) => {
      for (let y = 0; y < h; y += 2){
        for (let x = 0; x < w; x += 2){
          const nx = x*0.012, ny = y*0.012;
          let n = 0, a = 1, f = 1;
          for (let o = 0; o < 4; o++){
            n += a * vnoise(nx*f + t*0.1, ny*f + t*0.07);
            a *= 0.5; f *= 2;
          }
          n = n/1.875;
          const thr = BAYER8[(y%8)*8 + (x%8)];
          const bit = n > thr ? 255 : 0;
          for (let dy = 0; dy < 2; dy++){
            for (let dx = 0; dx < 2; dx++){
              const i = ((y+dy)*w + (x+dx))*4;
              data[i]=data[i+1]=data[i+2]=bit; data[i+3]=255;
            }
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    });
    return { canvas, destroy: stop };
  }

  // --- 5. ASCII / code rain ------------------------------------------------
  function codeRain(opts = {}){
    const w = opts.w || 1920, h = opts.h || 1080;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const cols = Math.floor(w / 18);
    const drops = new Array(cols).fill(0).map(() => Math.random()*h);
    const chars = '01░▒▓█▄▀■◆◇◦•╌┆┊┃';
    const stop = rAF(() => {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0,0,w,h);
      ctx.font = '14px ui-monospace, Menlo, monospace';
      for (let i = 0; i < cols; i++){
        const x = i*18;
        const y = drops[i];
        const ch = chars[Math.floor(Math.random()*chars.length)];
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(ch, x, y);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(chars[Math.floor(Math.random()*chars.length)], x, y-16);
        drops[i] += 14;
        if (drops[i] > h + Math.random()*120) drops[i] = -Math.random()*200;
      }
    });
    return { canvas, destroy: stop };
  }

  // --- 6. Scanline CRT grid ------------------------------------------------
  function scanlines(opts = {}){
    const w = opts.w || 1920, h = opts.h || 1080;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const stop = rAF((t) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 4){
        const off = Math.sin(t*2 + y*0.02)*1.2;
        ctx.beginPath();
        ctx.moveTo(0, y+off);
        ctx.lineTo(w, y+off);
        ctx.stroke();
      }
      // sweep band
      const band = ((t*80) % (h+200)) - 100;
      const grad = ctx.createLinearGradient(0, band-60, 0, band+60);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5,'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, band-60, w, 120);
    });
    return { canvas, destroy: stop };
  }

  window.Shaders = {
    halftonePortrait, orderedDither, dotField, noiseField, codeRain, scanlines
  };
})();
