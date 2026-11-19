/* ============================================================
   DJ LOOP BATTLE · Style Morph 引擎
   双 Deck / 16 Loop Pad / EQ·滤波 / FX / Hot Cue / 录制 / 计分
   ============================================================ */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- DOM 构建 ---------------- */
function deckHTML(side) {
  const cueBtns = [0, 1, 2, 3].map(i =>
    `<button class="hotcue" data-i="${i}"><b>CUE${i + 1}</b><span>--</span></button>`).join("");
  const lens = [["1", 16], ["2", 32], ["4", 64], ["8", 128]].map(([l, v]) =>
    `<button class="llen" data-len="${v}" ${v === 16 ? 'data-def="1"' : ""}>${l}</button>`).join("");
  const pads = Array.from({ length: 8 }, (_, i) =>
    `<button class="pad" data-i="${i}"><b>--</b><i>--</i></button>`).join("");
  return `
  <div class="deck-top">
    <div class="deck-tag">DECK ${side}</div>
    <div class="wave-wrap"><canvas class="wave"></canvas><div class="wave-grid"></div></div>
  </div>
  <div class="deck-mid">
    <div class="platter-zone">
      <div class="platter-base"></div>
      <div class="platter">
        <div class="vinyl"><div class="grooves"></div><div class="label"><span>${side}</span></div><div class="sticker"></div><div class="spindle"></div></div>
        <div class="ring-glow"></div>
      </div>
    </div>
    <div class="deck-side">
      <div class="pitch-wrap">
        <div class="fader-v pitch-fader"><div class="fader-cap"></div></div>
        <span class="pitch-val">+0.0%</span><span class="tag">PITCH</span>
      </div>
      <div class="deck-btns">
        <button class="sq-btn play-btn">▶</button>
        <button class="sq-btn sync-btn">SYNC</button>
        <button class="sq-btn cue-head">🎧CUE</button>
      </div>
    </div>
  </div>
  <div class="hotcue-row">${cueBtns}<div class="looplen"><span class="tag">LOOP</span>${lens}</div></div>
  <div class="fx-row">
    <div class="fx-sel"><span class="tag">FX</span>
      <select class="fxsel"><option>OFF</option><option>ECHO</option><option>REVERB</option><option>CRUSH</option><option>FLANGE</option></select>
    </div>
    <div class="knob-unit"><div class="knob fx-knob" data-min="0" data-max="1" data-val="0.35"><div class="cap"></div></div><span>FX 量</span></div>
    <div class="knob-unit"><div class="knob filter-knob" data-min="-1" data-max="1" data-val="0"><div class="cap"></div></div><span>FILTER</span></div>
  </div>
  <div class="pads">${pads}</div>`;
}

function mixerHTML() {
  const ch = side => `
  <div class="mix-ch" data-ch="${side}">
    <span class="ch-tag">CH-${side}</span>
    <div class="knob-unit"><div class="knob eq" data-eq="hi" data-min="-1" data-max="1" data-val="0"><div class="cap"></div></div><span>HI</span></div>
    <div class="knob-unit"><div class="knob eq" data-eq="mid" data-min="-1" data-max="1" data-val="0"><div class="cap"></div></div><span>MID</span></div>
    <div class="knob-unit"><div class="knob eq" data-eq="low" data-min="-1" data-max="1" data-val="0"><div class="cap"></div></div><span>LOW</span></div>
    <div class="ch-fader-zone"><div class="fader-v ch-fader"><div class="fader-cap"></div></div></div>
  </div>`;
  return `
  <div class="mix-title">MIXER</div>
  <div class="mix-body">
    ${ch("A")}
    <div class="mix-mid">
      <span class="tag">VU·A&nbsp;&nbsp;MST&nbsp;&nbsp;VU·B</span>
      <div style="display:flex;gap:5px;flex:1;min-height:0">
        <canvas class="vu" id="vuA"></canvas><canvas class="vu" id="vuM"></canvas><canvas class="vu" id="vuB"></canvas>
      </div>
    </div>
    ${ch("B")}
  </div>
  <div class="xf-zone">
    <div class="fader-h" id="xfader"><div class="fader-cap"></div></div>
    <div class="xf-tags"><span>◀ DECK A</span><span>CROSSFADER</span><span>DECK B ▶</span></div>
  </div>`;
}

$("#deckA").innerHTML = deckHTML("A");
$("#deckB").innerHTML = deckHTML("B");
$("#mixer").innerHTML = mixerHTML();

/* ---------------- 通用拖拽：旋钮 ---------------- */
function makeKnob(el, onChange) {
  const min = +el.dataset.min, max = +el.dataset.max;
  let val = +el.dataset.val;
  const cap = $(".cap", el);
  const render = () => {
    const t = (val - min) / (max - min);
    cap.style.transform = `rotate(${-135 + t * 270}deg)`;
  };
  const set = (v, fire = true) => { val = clamp(v, min, max); render(); if (fire) onChange(val); };
  el.addEventListener("pointerdown", e => {
    e.preventDefault();
    const y0 = e.clientY, v0 = val;
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    const move = ev => { if (!ev.buttons) return up(); set(v0 + (y0 - ev.clientY) / 130 * (max - min)); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  el.addEventListener("dblclick", () => set((min + max) / 2));
  render();
  return { set, get: () => val };
}

/* ---------------- 通用拖拽：推子（垂直/水平） ---------------- */
function makeFader(slot, { horizontal = false, init = 0.5 } = {}, onChange) {
  const cap = $(".fader-cap", slot);
  let val = init; // 0..1（垂直：1=顶）
  const render = () => {
    if (horizontal) cap.style.left = `${8 + val * 84}%`;
    else cap.style.top = `${(1 - val) * 82 + 9}%`;
  };
  const set = (v, fire = true) => { val = clamp(v, 0, 1); render(); if (fire) onChange(val); };
  slot.addEventListener("pointerdown", e => {
    e.preventDefault();
    const r = slot.getBoundingClientRect();
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    const move = ev => {
      if (ev.type === "pointermove" && !ev.buttons) return up();
      set(horizontal ? (ev.clientX - r.left) / r.width : 1 - (ev.clientY - r.top) / r.height);
    };
    move(e);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  render();
  return { set, get: () => val };
}

/* ---------------- 搓碟（jog wheel） ---------------- */
function makeJog(platter, deck) {
  let dragging = false, lastAng = 0, lastT = 0;
  const angOf = e => {
    const r = platter.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  platter.addEventListener("pointerdown", e => {
    e.preventDefault();
    dragging = true; deck.scratching = true; platter.classList.add("hot");
    lastAng = angOf(e); lastT = performance.now();
    const up = () => {
      dragging = false; deck.scratching = false; deck.jogVel = 0;
      platter.classList.remove("hot");
      if (engine.ctx) scratchBend(deck);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    };
    const move = ev => {
      if (!ev.buttons) return up();
      let d = angOf(ev) - lastAng;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      const now = performance.now(), dt = Math.max(8, now - lastT);
      deck.jogVel = d / (dt / 1000);          // rad/s
      deck.angle += d * 57.29578;             // 视觉角度
      lastAng = angOf(ev); lastT = now;
      if (engine.ctx) scratchBend(deck);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
}
/* ================================================================
   音频引擎
   ================================================================ */
const engine = {
  ctx: null, bpm: 128, styleKey: "cyber",
  nextBeat: 0, beatCount: 0, beatQueue: [],
  score: 0, combo: 0, presses: [],
  decks: [],
};
let ctx = null, NOISE = null;

function initAudio() {
  ctx = engine.ctx = new (window.AudioContext || window.webkitAudioContext)();
  // 噪声源缓冲
  NOISE = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = NOISE.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  // 混响脉冲响应
  engine.ir = ctx.createBuffer(2, ctx.sampleRate * 1.8, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = engine.ir.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
  }
  // 主总线
  engine.master = ctx.createGain();
  engine.masterAna = ctx.createAnalyser(); engine.masterAna.fftSize = 1024;
  engine.comp = ctx.createDynamicsCompressor();
  engine.comp.threshold.value = -14; engine.comp.ratio.value = 5;
  engine.monMaster = ctx.createGain();           // 监听（主路）
  engine.monCue = ctx.createGain(); engine.monCue.gain.value = 0;  // 监听（耳机预听路）
  engine.cueBus = ctx.createGain();
  engine.recDest = ctx.createMediaStreamDestination();
  engine.master.connect(engine.masterAna);
  engine.masterAna.connect(engine.comp);
  engine.comp.connect(engine.monMaster); engine.monMaster.connect(ctx.destination);
  engine.comp.connect(engine.recDest);           // 录音走主路，不含耳机预听
  engine.cueBus.connect(engine.monCue); engine.monCue.connect(ctx.destination);

  engine.decks.forEach(buildDeckGraph);
  engine.nextBeat = ctx.currentTime + 0.1;
  engine.decks.forEach(d => { d.nextTick = engine.nextBeat; });
  setInterval(tickScheduler, 25);
}

function buildDeckGraph(d) {
  d.in = ctx.createGain();
  d.scratch = ctx.createDelay(0.5); d.scratch.delayTime.value = 0.06;
  d.eqLow = ctx.createBiquadFilter(); d.eqLow.type = "lowshelf"; d.eqLow.frequency.value = 220;
  d.eqMid = ctx.createBiquadFilter(); d.eqMid.type = "peaking"; d.eqMid.frequency.value = 1100; d.eqMid.Q.value = 0.9;
  d.eqHi = ctx.createBiquadFilter(); d.eqHi.type = "highshelf"; d.eqHi.frequency.value = 4200;
  d.filter = ctx.createBiquadFilter(); d.filter.type = "lowpass"; d.filter.frequency.value = 20000; d.filter.Q.value = 0.7;
  d.fxWet = ctx.createGain(); d.fxWet.gain.value = 0;
  d.sum = ctx.createGain();
  d.ana = ctx.createAnalyser(); d.ana.fftSize = 1024;
  d.chGain = ctx.createGain(); d.chGain.gain.value = 0.85;
  d.xfGain = ctx.createGain();
  d.cueGain = ctx.createGain(); d.cueGain.gain.value = 0;
  d.in.connect(d.scratch); d.scratch.connect(d.eqLow); d.eqLow.connect(d.eqMid);
  d.eqMid.connect(d.eqHi); d.eqHi.connect(d.filter);
  d.filter.connect(d.sum); d.fxWet.connect(d.sum);
  d.sum.connect(d.ana); d.ana.connect(d.chGain); d.chGain.connect(d.xfGain);
  d.xfGain.connect(engine.master);
  d.sum.connect(d.cueGain); d.cueGain.connect(engine.cueBus);
  d.fxNodes = [];
  applyXfade();
}

function scratchBend(d) {
  const v = clamp(d.jogVel / 26, -1, 1);
  d.scratch.delayTime.setTargetAtTime(0.06 - v * 0.052, ctx.currentTime, 0.045);
}

function buildFx(d, type) {
  d.fxNodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
  d.fxNodes = []; d.fxType = type;
  if (!ctx || type === "OFF") { if (d.fxWet) d.fxWet.gain.value = 0; return; }
  const src = d.filter, beat = 60 / engine.bpm;
  if (type === "ECHO") {
    const dl = ctx.createDelay(2), fb = ctx.createGain(), hp = ctx.createBiquadFilter();
    dl.delayTime.value = beat * 0.75; fb.gain.value = 0.42; hp.type = "highpass"; hp.frequency.value = 350;
    src.connect(dl); dl.connect(fb); fb.connect(hp); hp.connect(dl); dl.connect(d.fxWet);
    d.fxNodes = [dl, fb, hp];
  } else if (type === "REVERB") {
    const cv = ctx.createConvolver(); cv.buffer = engine.ir;
    src.connect(cv); cv.connect(d.fxWet); d.fxNodes = [cv];
  } else if (type === "CRUSH") {
    const ws = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.round(x * 7) / 7; }
    ws.curve = curve; lp.type = "lowpass"; lp.frequency.value = 3400;
    src.connect(ws); ws.connect(lp); lp.connect(d.fxWet); d.fxNodes = [ws, lp];
  } else if (type === "FLANGE") {
    const dl = ctx.createDelay(0.05), lfo = ctx.createOscillator(), lg = ctx.createGain(), fb = ctx.createGain();
    dl.delayTime.value = 0.0045; lfo.frequency.value = 0.4; lg.gain.value = 0.0032; fb.gain.value = 0.5;
    lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
    src.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(d.fxWet);
    d.fxNodes = [dl, lfo, lg, fb];
  }
  d.fxWet.gain.value = d.fxAmt;
}

/* ---------------- 合成音源原语 ---------------- */
function noiseHit(t, o, { dur = 0.18, type = "highpass", f = 7000, Q = 1, g = 0.5, att = 0.001, slide = 0 }) {
  const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = Q;
  if (slide) flt.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + att);
  gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(flt); flt.connect(gn); gn.connect(o);
  s.start(t); s.stop(t + dur + 0.05);
}
function tone(t, o, { type = "sine", f0 = 200, f1 = 0, fd = 0.1, dur = 0.25, g = 0.5, att = 0.004, det = 0, lp = 0, lpQ = 1, vib = 0, vibF = 5 }) {
  const os = ctx.createOscillator(); os.type = type;
  os.frequency.setValueAtTime(f0, t);
  if (f1) os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + fd);
  if (det) os.detune.value = det;
  let node = os;
  if (vib) { const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = vibF; lg.gain.value = vib; lf.connect(lg); lg.connect(os.detune); lf.start(t); lf.stop(t + dur + 0.1); }
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(lp, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, lp * 0.12), t + dur); fl.Q.value = lpQ; os.connect(fl); node = fl; }
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + att);
  gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  node.connect(gn); gn.connect(o);
  os.start(t); os.stop(t + dur + 0.1);
}

/* ---------------- 风格化乐器 ---------------- */
const INST = {
  kick(t, o, fl) {
    if (fl === "bit8") tone(t, o, { type: "square", f0: 130, f1: 50, fd: 0.07, dur: 0.12, g: 0.5 });
    else if (fl === "guofeng") { tone(t, o, { f0: 95, f1: 42, fd: 0.18, dur: 0.42, g: 0.95 }); noiseHit(t, o, { dur: 0.05, type: "bandpass", f: 1700, g: 0.3 }); }
    else { tone(t, o, { f0: 165, f1: 44, fd: 0.1, dur: 0.3, g: 1.0 }); noiseHit(t, o, { dur: 0.025, f: 6000, g: 0.25 }); }
  },
  snare(t, o, fl) {
    if (fl === "bit8") noiseHit(t, o, { dur: 0.09, type: "bandpass", f: 2400, g: 0.5 });
    else if (fl === "guofeng") { noiseHit(t, o, { dur: 0.14, type: "bandpass", f: 3200, Q: 1.4, g: 0.5 }); tone(t, o, { f0: 420, f1: 320, fd: 0.05, dur: 0.09, g: 0.3 }); }
    else { noiseHit(t, o, { dur: 0.16, f: 1700, g: 0.55 }); tone(t, o, { type: "triangle", f0: 190, f1: 150, fd: 0.06, dur: 0.1, g: 0.4 }); }
  },
  clap(t, o) { [0, 0.012, 0.026].forEach(dt => noiseHit(t + dt, o, { dur: 0.05, type: "bandpass", f: 1400, Q: 1.6, g: 0.38 })); noiseHit(t + 0.03, o, { dur: 0.22, type: "bandpass", f: 1500, Q: 1.2, g: 0.3 }); },
  hat(t, o, fl, open) {
    const d = open ? 0.3 : (fl === "bit8" ? 0.03 : 0.05);
    noiseHit(t, o, { dur: d, f: fl === "guofeng" ? 8400 : 7600, g: open ? 0.3 : 0.24 });
  },
  perc(t, o, fl) {
    if (fl === "guofeng") tone(t, o, { type: "square", f0: 1250, f1: 900, fd: 0.02, dur: 0.05, g: 0.3 }); // 木鱼
    else if (fl === "bit8") tone(t, o, { type: "square", f0: 880, f1: 1760, fd: 0.04, dur: 0.06, g: 0.22 });
    else noiseHit(t, o, { dur: 0.07, type: "bandpass", f: 3300, Q: 5, g: 0.4 });
  },
  gong(t, o) {
    [1, 1.48, 2.04, 2.67].forEach((r, i) => tone(t, o, { f0: 96 * r, dur: 2.2 - i * 0.3, g: 0.26 / (i * 0.6 + 1), det: i * 7 }));
    noiseHit(t, o, { dur: 0.6, type: "bandpass", f: 500, Q: 2, g: 0.18 });
  },
  bass(t, o, fl, f, dur) {
    if (fl === "bit8") tone(t, o, { type: "triangle", f0: f, dur, g: 0.62 });
    else if (fl === "cyber") { tone(t, o, { type: "sawtooth", f0: f, dur, g: 0.4, lp: 900, lpQ: 6 }); tone(t, o, { type: "sawtooth", f0: f, det: 18, dur, g: 0.3, lp: 700, lpQ: 4 }); }
    else if (fl === "idol") { tone(t, o, { type: "square", f0: f, dur: dur * 0.6, g: 0.36, lp: 1500, lpQ: 2 }); tone(t, o, { f0: f / 2, dur, g: 0.4 }); }
    else tone(t, o, { f0: f, dur, g: 0.55, lp: 1100 });
  },
  pluck(t, o, fl, f, dur) { // 古筝 / 琵琶质感
    tone(t, o, { type: "triangle", f0: f, dur: Math.min(dur, 0.7), g: 0.5, lp: f * 5, lpQ: 1.5, att: 0.002 });
    tone(t, o, { type: "sine", f0: f * 2, dur: 0.12, g: 0.18 });
    noiseHit(t, o, { dur: 0.02, type: "bandpass", f: f * 4, Q: 3, g: 0.2 });
  },
  chip(t, o, fl, f, dur) { tone(t, o, { type: "square", f0: f, dur, g: 0.22, att: 0.001 }); },
  lead(t, o, fl, f, dur) {
    if (fl === "bit8") { tone(t, o, { type: "square", f0: f, dur, g: 0.26 }); tone(t, o, { type: "square", f0: f * 2.01, dur: dur * 0.7, g: 0.08 }); }
    else if (fl === "guofeng") tone(t, o, { type: "sine", f0: f, dur, g: 0.4, vib: 22, vibF: 5.5, att: 0.05 }); // 笛箫
    else if (fl === "idol") [0, -9, 9].forEach(d => tone(t, o, { type: "sawtooth", f0: f, det: d, dur, g: 0.16, lp: 6500, att: 0.01 }));
    else [0, -14, 14].forEach(d => tone(t, o, { type: "sawtooth", f0: f, det: d, dur, g: 0.14, lp: 3800, lpQ: 2 }));
  },
  stab(t, o, fl, f, dur, degs, st) {
    (degs || [0, 2, 4]).forEach(dg => {
      const ff = degFreq(st, dg, 12);
      if (fl === "bit8") tone(t, o, { type: "square", f0: ff, dur: dur * 0.8, g: 0.13 });
      else if (fl === "guofeng") INST.pluck(t, o, fl, ff, dur);
      else [0, -10, 10].forEach(d => tone(t, o, { type: "sawtooth", f0: ff, det: d, dur, g: 0.07, lp: 5200, att: 0.012 }));
    });
  },
  vox(t, o, fl, f, dur) { // 虚拟歌姬式元音颗粒（共振峰）
    const vowels = [[700, 1100], [380, 2200], [550, 1700]];
    const [f1, f2] = vowels[(Math.round(f) + Math.round(t * 7)) % 3];
    const src = ctx.createOscillator(); src.type = "sawtooth"; src.frequency.value = f;
    src.detune.setValueAtTime(40, t); src.detune.linearRampToValueAtTime(0, t + 0.06);
    const vb = ctx.createOscillator(), vg = ctx.createGain(); vb.frequency.value = 5.8; vg.gain.value = 14;
    vb.connect(vg); vg.connect(src.detune); vb.start(t); vb.stop(t + dur + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.025); g.gain.setValueAtTime(0.8, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0008, t + dur);
    [[f1, 7, 0.9], [f2, 9, 0.55], [2900, 11, 0.2]].forEach(([fc, q, amt]) => {
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fc; bp.Q.value = q;
      const ag = ctx.createGain(); ag.gain.value = amt;
      src.connect(bp); bp.connect(ag); ag.connect(g);
    });
    g.connect(o); src.start(t); src.stop(t + dur + 0.1);
  },
  bell(t, o, fl, f, dur) { [1, 2.76, 5.4].forEach((r, i) => tone(t, o, { f0: f * r, dur: dur / (i + 1), g: 0.2 / (i + 1), att: 0.001 })); },
  riser(t, o, fl) { noiseHit(t, o, { dur: 0.95, type: "bandpass", f: 400, Q: 2.5, g: 0.3, att: 0.4, slide: 6500 }); },
  gliss(t, o) { // 古筝刮奏（固定五声音阶，不随半音谱面变化）
    const st = padSrc(), PENT = [0, 2, 4, 7, 9];
    for (let i = 0; i < 8; i++) {
      const semi = PENT[i % 5] + 12 * Math.floor(i / 5);
      INST.pluck(t + i * 0.035, o, "guofeng", 440 * Math.pow(2, (st.root + 24 + semi - 69) / 12), 0.3);
    }
  },
  drone(t, o, fl, f, dur) { tone(t, o, { type: "sawtooth", f0: f, dur, g: 0.13, lp: 800, att: dur * 0.3 }); tone(t, o, { type: "sawtooth", f0: f * 1.005, det: 8, dur, g: 0.11, lp: 600, att: dur * 0.3 }); },
};

/* 观众欢呼（合成） */
function cheer(t, inten) {
  const o = engine.master;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * inten + 0.08, t + 0.22);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 1.5);
  const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true; s.playbackRate.value = 0.8;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(900, t);
  bp.frequency.linearRampToValueAtTime(1600, t + 0.5); bp.Q.value = 0.55;
  s.connect(bp); bp.connect(g); g.connect(o); s.start(t); s.stop(t + 1.7);
  for (let i = 0; i < 5; i++) { // 口哨 & 呐喊
    const tt = t + 0.05 + i * 0.11, f0 = 520 + (i * 137) % 300;
    tone(tt, o, { f0, f1: f0 * 1.6, fd: 0.22, dur: 0.3, g: 0.05 * inten, type: "sine", vib: 30, vibF: 9 });
  }
}
/* ================================================================
   四种曲风：音阶 / BPM / 16 个 Loop Pad（A 0-7 节奏 · B 8-15 旋律）
   ================================================================ */
function degFreq(st, deg, sh = 0) {
  const sc = st.scale, n = sc.length;
  const oct = Math.floor(deg / n), idx = ((deg % n) + n) % n;
  return 440 * Math.pow(2, (st.root + sh + sc[idx] + 12 * oct - 69) / 12);
}
function parseN(s) { // "步:度[+度…][~时值]，…"
  const m = {};
  s.split(",").forEach(tok => {
    const [st, rest] = tok.split(":");
    const [dgs, dur] = rest.split("~");
    const arr = dgs.split("+").map(Number);
    if (dur) arr.dr = +dur;
    m[+st] = arr;
  });
  return m;
}

const STYLES = {
  bit8: {
    name: "8-BIT 像素", bpm: 118, root: 36, scale: [0, 2, 4, 7, 9],
    pads: [
      { l: "KICK", i: "像素底鼓", t: "kick", p: "x...x...x...x..." },
      { l: "SNARE", i: "军鼓", t: "snare", p: "....x.......x..." },
      { l: "HAT", i: "踩镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "BLIP", i: "电子音粒", t: "perc", p: "..x...x...x..x.." },
      { l: "BASS", i: "三角波贝斯", t: "bass", n: "0:0,2:0,4:2,6:0,8:3,10:0,12:2,14:1", dr: 2 },
      { l: "ARP", i: "琶音器", t: "chip", n: "0:0,1:2,2:4,3:5,4:0,5:2,6:4,7:5,8:1,9:3,10:5,11:6,12:0,13:2,14:4,15:5", dr: 1 },
      { l: "LEAD", i: "冒险主题", t: "lead", n: "0:4,3:5,6:4,8:2,11:1,14:0", dr: 2, up2: 1 },
      { l: "STAB", i: "和弦", t: "stab", n: "0:0,8:3", dr: 4 },
      { l: "KICK·B", i: "切分底鼓", t: "kick", p: "x..x..x.x..x..x." },
      { l: "FILL", i: "军鼓填充", t: "snare", p: "....x..x..x.x.xx" },
      { l: "O-HAT", i: "开镲", t: "hat", p: "..o...o...o...o." },
      { l: "SWEEP", i: "上升音效", t: "riser", p: "x..............." },
      { l: "BASS·B", i: "贝斯变奏", t: "bass", n: "0:0,3:0,6:1,8:2,11:2,14:3", dr: 2 },
      { l: "ARP·B", i: "下行琶音", t: "chip", n: "0:5,1:4,2:2,3:0,4:5,5:4,6:2,7:0,8:6,9:5,10:3,11:1,12:5,13:4,14:2,15:0", dr: 1 },
      { l: "LEAD·B", i: "副旋律", t: "lead", n: "0:7,2:6,4:5,8:4,10:5,12:6", dr: 2 },
      { l: "CHORD", i: "和弦进行", t: "stab", n: "0:0,4:3,8:4,12:3", dr: 4 },
    ],
  },
  cyber: {
    name: "赛博朋克", bpm: 128, root: 33, scale: [0, 2, 3, 5, 7, 8, 10],
    pads: [
      { l: "KICK", i: "重型底鼓", t: "kick", p: "x...x...x...x..." },
      { l: "CLAP", i: "电子拍手", t: "clap", p: "....x.......x..." },
      { l: "HAT", i: "16分踩镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "METAL", i: "工业打击", t: "perc", p: "..x..x...x..x..x" },
      { l: "REESE", i: "撕裂贝斯", t: "bass", n: "0:0,4:0,6:4,8:0,12:2,14:1", dr: 2 },
      { l: "ACID", i: "酸性线条", t: "bass", n: "0:0,1:0,2:6,3:0,4:4,6:0,8:0,9:6,10:0,12:4,14:2", dr: 1, sh: 24 },
      { l: "LEAD", i: "暗黑旋律", t: "lead", n: "0:0,3:2,6:3,8:5,11:4,14:2", dr: 2, up2: 1 },
      { l: "STAB", i: "小调和弦", t: "stab", n: "0:0,8:4", dr: 4 },
      { l: "KICK·B", i: "滚动底鼓", t: "kick", p: "x...x...x...x.xx" },
      { l: "SNR·B", i: "断奏军鼓", t: "snare", p: "....x.....x.x..." },
      { l: "RIDE", i: "开镲律动", t: "hat", p: "o...o...o...o..." },
      { l: "RISER", i: "升空音效", t: "riser", p: "x..............." },
      { l: "SUB", i: "下潜低音", t: "bass", n: "0:0,8:2", dr: 7 },
      { l: "ARP·B", i: "霓虹琶音", t: "chip", n: "0:0,1:3,2:5,3:7,4:0,5:3,6:5,7:7,8:1,9:4,10:6,11:8,12:1,13:4,14:6,15:8", dr: 1, sh: 36 },
      { l: "LEAD·B", i: "电流旋律", t: "lead", n: "0:7,3:5,6:4,10:3,13:2", dr: 2 },
      { l: "DRONE", i: "氛围铺底", t: "drone", n: "0:0", dr: 16 },
    ],
  },
  guofeng: {
    name: "国风电子", bpm: 102, root: 38, scale: [0, 2, 4, 7, 9],
    pads: [
      { l: "太鼓", i: "电子太鼓", t: "kick", p: "x...x...x..x...x" },
      { l: "板鼓", i: "板鼓点", t: "snare", p: "....x.......x.x." },
      { l: "镲", i: "小镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "木鱼", i: "木鱼律动", t: "perc", p: "..x...x...x..x.." },
      { l: "低音", i: "电子低音", t: "bass", n: "0:0,4:0,8:3,12:2", dr: 3 },
      { l: "古筝", i: "古筝轮指", t: "pluck", n: "0:0,2:2,4:4,6:5,8:4,10:2,12:1,14:0", dr: 2, sh: 36 },
      { l: "竹笛", i: "笛声旋律", t: "lead", n: "0:4,4:5,7:4,8:2,12:1", dr: 3, up2: 1 },
      { l: "锣", i: "大锣", t: "gong", p: "x..............." },
      { l: "战鼓", i: "战鼓阵", t: "kick", p: "x.x.x...x.x.x..." },
      { l: "拍板", i: "醒木拍板", t: "clap", p: "....x.......x..." },
      { l: "碰铃", i: "碰铃", t: "bell", n: "0:9,8:11", dr: 3, sh: 36 },
      { l: "刮奏", i: "古筝刮奏", t: "gliss", p: "x.......x......." },
      { l: "低音·B", i: "低音变奏", t: "bass", n: "0:0,3:0,6:1,8:3,11:3,14:4", dr: 2 },
      { l: "筝·B", i: "古筝快板", t: "pluck", n: "0:4,1:5,2:6,4:5,6:4,8:2,9:3,10:4,12:2,14:0", dr: 1, sh: 36 },
      { l: "胡琴", i: "弦乐线条", t: "lead", n: "0:7,4:6,8:5,11:4,14:5", dr: 3 },
      { l: "钟声", i: "庙堂钟", t: "bell", n: "0:0,8:2", dr: 6, sh: 24 },
    ],
  },
  idol: {
    name: "虚拟歌姬演唱会", bpm: 138, root: 41, scale: [0, 2, 4, 5, 7, 9, 11],
    pads: [
      { l: "KICK", i: "舞台底鼓", t: "kick", p: "x...x...x...x..." },
      { l: "CLAP", i: "应援拍手", t: "clap", p: "....x.......x..." },
      { l: "HAT", i: "闪亮踩镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "ROLL", i: "军鼓滚奏", t: "snare", p: "..........x.x.xx" },
      { l: "BASS", i: "蹦跳贝斯", t: "bass", n: "0:0,2:0,4:0,6:0,8:3,10:3,12:4,14:4", dr: 1 },
      { l: "SAWS", i: "电音和弦", t: "stab", n: "0:0,4:5,8:3,12:4", dr: 3 },
      { l: "LEAD", i: "高光旋律", t: "lead", n: "0:7,2:8,4:9,8:7,11:5,14:4", dr: 2 },
      { l: "VOX", i: "歌姬声线", t: "vox", n: "0:0,3:2,6:4,8:7,11:4,14:2", dr: 2, sh: 36 },
      { l: "KICK·B", i: "变奏底鼓", t: "kick", p: "x..x..x...x..x.." },
      { l: "FILL", i: "高潮填充", t: "clap", p: "....x.x...x.xxxx" },
      { l: "O-HAT", i: "开镲", t: "hat", p: "..o...o...o...o." },
      { l: "RISER", i: "副歌前奏", t: "riser", p: "x..............." },
      { l: "BASS·B", i: "八度贝斯", t: "bass", n: "0:0,1:7,2:0,3:7,4:3,5:10,6:3,7:10,8:4,9:11,10:4,11:11,12:5,13:12,14:5,15:12", dr: 1 },
      { l: "SPARK", i: "星光琶音", t: "chip", n: "0:0,1:2,2:4,3:7,4:9,5:7,6:4,7:2,8:0,9:2,10:4,11:7,12:9,13:11,14:9,15:7", dr: 1, sh: 36 },
      { l: "VOX·B", i: "副歌声线", t: "vox", n: "0:7,3:6,6:5,8:4,10:5,12:7", dr: 2, sh: 36 },
      { l: "PAD", i: "梦幻铺底", t: "drone", n: "0:0", dr: 16 },
    ],
  },
};
const STYLE_ORDER = ["bit8", "cyber", "guofeng", "idol"];

/* ================================================================
   曲目库：耳熟能详旋律的电音变奏（旋律数据 × 当前曲风音色 = 变奏）
   ================================================================ */
const SONGS = {
  /* 半音转录：度数=半音数（简谱 1=0 2=2 3=4 5=7 6=9 1'=12；低音为负），原曲节奏 */
  pvz: { // 植物大战僵尸《Grasswalk》主题（E 小调）
    name: "植物大战僵尸", bpm: 110, root: 40, loopLen: 64,
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    pads: [
      { l: "行军鼓", i: "草坪进行曲", t: "kick", p: "x...x...x...x..." },
      { l: "军鼓", i: "小鼓", t: "snare", p: "....x.......x..." },
      { l: "镲", i: "踩镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "木琴", i: "跳跳音粒", t: "perc", p: "..x...x...x..x.." },
      { l: "BASS", i: "根音五度", t: "bass", n: "0:0,4:7,8:0,12:7", dr: 1 },
      { l: "主题A", i: "Grasswalk 上句", t: "lead", bars: 2, n: "0:0,2:3,4:0,6:-2,8:0,10:3,12:5,14:3,16:0,18:-2,20:-4,22:-2,24:0~6", dr: 2 },
      { l: "主题B", i: "Grasswalk 下句", t: "lead", bars: 2, n: "0:3,2:5,4:7,6:5,8:3,10:0,12:3,14:5,16:3,18:0,20:-2,24:0~6", dr: 2 },
      { l: "和声", i: "Em / Am", t: "pluck", n: "0:0+3+7~4,8:5+8+12~4", dr: 4 },
      { l: "鼓·变奏", i: "切分行军", t: "kick", p: "x..x..x.x..x..x." },
      { l: "音乐盒", i: "发条铃", t: "bell", n: "0:12,4:12,8:12,12:12", dr: 1, sh: 24 },
      { l: "脚步", i: "僵尸脚步", t: "perc", p: "x.......x......." },
      { l: "来袭", i: "一大波僵尸", t: "riser", p: "x..............." },
      { l: "BASS·B", i: "游走低音", t: "bass", n: "0:0,2:3,4:5,6:7,8:5,10:3,12:-2,14:0", dr: 1 },
      { l: "对位", i: "八度琶音", t: "chip", n: "0:0,2:7,4:12,6:7,8:0,10:7,12:12,14:7", dr: 1, sh: 36 },
      { l: "全曲", i: "完整主题旋律", t: "lead", bars: 4, n: "0:0,2:3,4:0,6:-2,8:0,10:3,12:5,14:3,16:0,18:-2,20:-4,22:-2,24:0~6,32:3,34:5,36:7,38:5,40:3,42:0,44:3,46:5,48:3,50:0,52:-2,56:0~6", dr: 2 },
      { l: "暮色", i: "夜场铺底", t: "drone", n: "0:0", dr: 16 },
    ],
  },
  hfh: { // 《男儿当自强》主题（将军令）
    name: "男儿当自强", bpm: 96, root: 43, loopLen: 128,
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    pads: [
      { l: "战鼓", i: "将军令鼓阵", t: "kick", p: "x...x...x..x...x" },
      { l: "排鼓", i: "过门鼓点", t: "snare", p: "....x.....x.x..." },
      { l: "镲", i: "行进小镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "木鱼", i: "板眼", t: "perc", p: "..x...x...x..x.." },
      { l: "低音", i: "行进低音", t: "bass", n: "0:0,4:0,8:-5,12:-3", dr: 2 },
      { l: "主题·一", i: "傲气面对万重浪", t: "lead", bars: 4, n: "0:-3~2,2:4~2,4:4~2,6:4~2,8:2~2,10:4~2,12:7~4,16:4~10,32:2~2,34:2~2,36:2~2,38:0~2,40:2~2,42:4~2,48:2~10", dr: 2 },
      { l: "主题·二", i: "胆似铁打骨似精钢", t: "lead", bars: 4, n: "0:0~3,4:2~3,8:4~3,12:7~3,16:9~3,20:9~2,22:7~2,24:9~6,32:12~3,36:9~3,40:7~3,44:4~3,48:2~2,50:4~2,52:2~2,54:0~2,56:-3~2,58:0~6", dr: 2 },
      { l: "锣", i: "开场大锣", t: "gong", p: "x..............." },
      { l: "急鼓", i: "双倍战鼓", t: "kick", p: "x.x.x...x.x.x..x" },
      { l: "拍板", i: "梆子拍板", t: "clap", p: "....x.......x..." },
      { l: "古筝", i: "轮指伴奏", t: "pluck", n: "0:0,2:4,4:7,6:9,8:7,10:4,12:2,14:0", dr: 1, sh: 36 },
      { l: "刮奏", i: "古筝刮奏", t: "gliss", p: "x.......x......." },
      { l: "低音·B", i: "低音变走", t: "bass", n: "0:0,2:0,4:7,6:7,8:9,10:9,12:7,14:2", dr: 1 },
      { l: "副旋律", i: "长音和声", t: "pluck", bars: 4, n: "0:0~4,8:4~4,16:2~8,32:0~4,40:2~4,48:0~8", dr: 4, sh: 24 },
      { l: "全曲", i: "完整主题旋律", t: "lead", bars: 8, n: "0:-3~2,2:4~2,4:4~2,6:4~2,8:2~2,10:4~2,12:7~4,16:4~10,32:2~2,34:2~2,36:2~2,38:0~2,40:2~2,42:4~2,48:2~10,64:0~3,68:2~3,72:4~3,76:7~3,80:9~3,84:9~2,86:7~2,88:9~6,96:12~3,100:9~3,104:7~3,108:4~3,112:2~2,114:4~2,116:2~2,118:0~2,120:-3~2,122:0~6", dr: 2 },
      { l: "钟", i: "庙堂钟声", t: "bell", n: "0:0,8:7", dr: 6, sh: 24 },
    ],
  },
  ygxy: { // 《云宫迅音》（西游记序曲）
    name: "云宫迅音", bpm: 126, root: 35, loopLen: 64,
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    pads: [
      { l: "迪斯科鼓", i: "天宫四踩", t: "kick", p: "x...x...x...x..." },
      { l: "拍手", i: "电子拍手", t: "clap", p: "....x.......x..." },
      { l: "镲", i: "十六分镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "电鼓", i: "筋斗云点", t: "perc", p: "..x...x...x..x.." },
      { l: "放克低音", i: "腾云贝斯", t: "bass", n: "0:0,3:0,6:10,8:0,10:0,12:7,14:10", dr: 1 },
      { l: "登登等灯", i: "开场电子riff", t: "lead", bars: 2, n: "0:12~1,1:12~1,2:12~1,3:10~1,4:12~2,8:12~1,9:12~1,10:12~1,11:10~1,12:12~2,16:3~2,18:5~2,20:7~2,22:10~2,24:12~6", dr: 1, sh: 24 },
      { l: "吟唱", i: "腾空女声", t: "vox", bars: 4, n: "0:12~8,16:10~2,18:12~2,20:15~6,28:12~2,32:15~2,34:12~2,36:10~2,38:7~2,40:10~6,48:12~12", dr: 2, sh: 36 },
      { l: "和弦", i: "云海和声", t: "pluck", n: "0:0+3+7~4,8:-2+3+5~4", dr: 4 },
      { l: "鼓·变奏", i: "切分律动", t: "kick", p: "x..x..x.x..x..x." },
      { l: "丢丢丢", i: "开场三连拨", t: "pluck", n: "0:12~1,2:12~1,4:12~1", dr: 1, sh: 24 },
      { l: "开镲", i: "反拍开镲", t: "hat", p: "..o...o...o...o." },
      { l: "来袭", i: "妖风骤起", t: "riser", p: "x..............." },
      { l: "低音·B", i: "游走低音", t: "bass", n: "0:0,2:3,4:5,6:7,8:10,10:7,12:5,14:3", dr: 1 },
      { l: "琶音", i: "云端琶音", t: "chip", n: "0:0,2:3,4:7,6:12,8:0,10:3,12:7,14:12", dr: 1, sh: 36 },
      { l: "全曲", i: "riff + 吟唱主题", t: "lead", bars: 4, n: "0:12~1,1:12~1,2:12~1,3:10~1,4:12~2,8:12~1,9:12~1,10:12~1,11:10~1,12:12~2,16:3~2,18:5~2,20:7~2,22:10~2,24:12~6,32:12~8,40:15~6,48:12~2,50:10~2,52:7~2,54:10~2,56:12~8", dr: 1, sh: 24 },
      { l: "云海", i: "氛围铺底", t: "drone", n: "0:0", dr: 16 },
    ],
  },
  molihua: { // 《茉莉花》（江苏民歌）
    name: "茉莉花", bpm: 92, root: 41, loopLen: 128,
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    pads: [
      { l: "底鼓", i: "柔和四踩", t: "kick", p: "x...x...x...x..." },
      { l: "军鼓", i: "轻拍", t: "snare", p: "....x.......x..." },
      { l: "镲", i: "细碎踩镲", t: "hat", p: "x.x.x.x.x.x.x.x." },
      { l: "水滴", i: "露珠音粒", t: "perc", p: "..x...x...x..x.." },
      { l: "低音", i: "暖低音", t: "bass", n: "0:0,4:0,8:-5,12:-3", dr: 2 },
      { l: "主题·上", i: "好一朵美丽的茉莉花", t: "lead", bars: 4, n: "0:4~3,4:4~2,6:7~2,8:9~3,12:12~2,14:12~2,16:9~2,18:7~2,20:7~2,22:9~3,26:7~6,32:4~3,36:4~2,38:7~2,40:9~3,44:12~2,46:12~2,48:9~2,50:7~2,52:7~2,54:9~3,58:7~6", dr: 2, sh: 24 },
      { l: "主题·下", i: "芬芳美丽满枝桠", t: "lead", bars: 4, n: "0:7~2,2:7~2,4:7~3,8:4~2,10:7~2,12:9~4,16:9~2,18:7~6,24:4~2,26:2~2,28:4~2,30:7~2,32:4~2,34:2~2,36:0~3,40:0~2,42:2~2,44:0~6,48:2~2,50:0~2,52:-3~3,56:0~8", dr: 2, sh: 24 },
      { l: "和声", i: "I / IV 和弦", t: "pluck", n: "0:0+4+7~4,8:5+9+12~4", dr: 4 },
      { l: "鼓·变奏", i: "切分律动", t: "kick", p: "x..x..x...x..x.." },
      { l: "拍手", i: "应和拍手", t: "clap", p: "....x.x.....x..." },
      { l: "古筝", i: "花指伴奏", t: "pluck", n: "0:0,2:4,4:7,6:9,8:12,10:9,12:7,14:4", dr: 1, sh: 36 },
      { l: "晚风", i: "氛围上升", t: "riser", p: "x..............." },
      { l: "低音·B", i: "八分低音", t: "bass", n: "0:0,2:0,4:4,6:4,8:7,10:7,12:9,14:9", dr: 1 },
      { l: "风铃", i: "高音点缀", t: "bell", n: "0:12,8:9", dr: 3, sh: 36 },
      { l: "全曲", i: "完整两段旋律", t: "lead", bars: 8, n: "0:4~3,4:4~2,6:7~2,8:9~3,12:12~2,14:12~2,16:9~2,18:7~2,20:7~2,22:9~3,26:7~6,32:4~3,36:4~2,38:7~2,40:9~3,44:12~2,46:12~2,48:9~2,50:7~2,52:7~2,54:9~3,58:7~6,64:7~2,66:7~2,68:7~3,72:4~2,74:7~2,76:9~4,80:9~2,82:7~6,88:4~2,90:2~2,92:4~2,94:7~2,96:4~2,98:2~2,100:0~3,104:0~2,106:2~2,108:0~6,112:2~2,114:0~2,116:-3~3,120:0~8", dr: 2, sh: 24 },
      { l: "月色", i: "梦境铺底", t: "drone", n: "0:0", dr: 16 },
    ],
  },
  saima: { // 《赛马》（二胡名曲）
    name: "赛马", bpm: 150, root: 38, loopLen: 64,
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    pads: [
      { l: "奔蹄鼓", i: "马蹄底鼓", t: "kick", p: "x..x..x.x..x..x." },
      { l: "军鼓", i: "扬鞭", t: "snare", p: "....x.......x..." },
      { l: "马蹄镲", i: "奔跑十六分", t: "hat", p: "x.xx.xx.x.xx.xx." },
      { l: "响板", i: "马蹄哒哒", t: "perc", p: "x..x..x.x..x..x." },
      { l: "低音", i: "奔驰贝斯", t: "bass", n: "0:0,3:0,6:7,8:0,11:0,14:7", dr: 1 },
      { l: "主题·上", i: "高音急奏+下行瀑布", t: "lead", bars: 2, n: "0:12~1,1:12~1,2:12~1,3:12~1,4:12~2,6:10~2,8:12~1,9:12~1,10:12~1,11:12~1,12:12~2,14:10~2,16:12~1,17:10~1,18:7~1,19:5~1,20:3~1,21:0~1,22:3~1,23:5~1,24:7~2,26:5~2,28:3~2,30:0~2", dr: 1, sh: 24 },
      { l: "主题·下", i: "奔腾主句", t: "lead", bars: 2, n: "0:7~2,2:5~2,4:3~2,6:5~2,8:7~2,10:10~2,12:7~2,14:5~2,16:3~2,18:5~2,20:7~2,22:5~2,24:3~8", dr: 1, sh: 24 },
      { l: "锣", i: "开赛锣", t: "gong", p: "x..............." },
      { l: "急鼓", i: "冲刺鼓", t: "kick", p: "x.x.x.x.x.x.x.xx" },
      { l: "拍手", i: "观众喝彩", t: "clap", p: "....x.......x..." },
      { l: "嘶鸣", i: "马嘶颤音", t: "lead", n: "0:12~1,1:15~1,2:12~1,3:15~1,4:12~4", dr: 1, sh: 24 },
      { l: "刮奏", i: "扫弦刮奏", t: "gliss", p: "x.......x......." },
      { l: "低音·B", i: "下行低音", t: "bass", n: "0:0,2:3,4:5,6:7,8:5,10:3,12:0,14:-2", dr: 1 },
      { l: "琶音", i: "疾驰琶音", t: "chip", n: "0:0,1:3,2:7,3:10,4:12,5:10,6:7,7:3,8:0,9:3,10:7,11:10,12:12,13:10,14:7,15:3", dr: 1, sh: 24 },
      { l: "全曲", i: "急奏+瀑布+主句", t: "lead", bars: 4, n: "0:12~1,1:12~1,2:12~1,3:12~1,4:12~2,6:10~2,8:12~1,9:12~1,10:12~1,11:12~1,12:12~2,14:10~2,16:12~1,17:10~1,18:7~1,19:5~1,20:3~1,21:0~1,22:3~1,23:5~1,24:7~2,26:5~2,28:3~2,30:0~2,32:7~2,34:5~2,36:3~2,38:5~2,40:7~2,42:10~2,44:7~2,46:5~2,48:3~2,50:5~2,52:7~2,54:5~2,56:3~8", dr: 1, sh: 24 },
      { l: "草原", i: "辽阔铺底", t: "drone", n: "0:0", dr: 16 },
    ],
  },
};
const padSrc = () => engine.songKey ? SONGS[engine.songKey] : STYLES[engine.styleKey];
[...Object.values(STYLES), ...Object.values(SONGS)].forEach(st =>
  st.pads.forEach(p => { if (p.n) p.map = parseN(p.n); }));

/* ---------------- 前瞻调度器 ---------------- */
const AHEAD = 0.14;
function anyPlaying() { return engine.decks.some(d => d.playing && d.active.size); }

function tickScheduler() {
  const now = ctx.currentTime;
  while (engine.nextBeat < now + AHEAD) {
    const b = engine.beatCount, t = engine.nextBeat;
    const ev = { t, b };
    if (b > 0 && b % 16 === 0 && anyPlaying()) {
      ev.scored = true;
      cheer(t, clamp(0.45 + engine.combo * 0.06, 0.45, 1));
    }
    engine.beatQueue.push(ev);
    engine.beatCount++;
    engine.nextBeat += 60 / engine.bpm;
  }
  engine.decks.forEach(d => {
    const stepDur = 60 / (engine.bpm * (1 + d.pitch / 100)) / 4;
    while (d.nextTick < now + AHEAD) {
      if (d.playing && d.active.size) scheduleDeckStep(d, d.tick, d.nextTick, stepDur);
      if (d.playing) d.tick = (d.tick + 1) % d.loopLen;
      d.nextTick += stepDur;
    }
  });
}

function scheduleDeckStep(d, tick, t, stepDur) {
  const st = padSrc();
  const bar = (tick >> 4) & 1;
  d.active.forEach(i => {
    const pd = st.pads[d.idx * 8 + i];
    const step = tick % ((pd.bars || 1) * 16); // 多小节乐句
    let hit = false;
    if (pd.p) {
      const c = pd.p[step % 16];
      if (c === "x" || c === "o") { firePad(pd, t, d, 0, stepDur, c === "o", st); hit = true; }
    } else if (pd.map && pd.map[step]) {
      const up = pd.up2 && bar ? st.scale.length : 0;
      const notes = pd.map[step];
      notes.forEach(dg => firePad(pd, t, d, dg + up, stepDur, false, st, notes.dr));
      hit = true;
    }
    if (hit) blinkPad(d, i, t);
  });
}

const DEF_SH = { bass: 12, stab: 24, lead: 36, chip: 36, pluck: 36, vox: 36, bell: 36, drone: 12, gliss: 24 };
function firePad(pd, t, d, deg, stepDur, open, st, drOv) {
  const fn = INST[pd.t]; if (!fn) return;
  const fl = engine.styleKey;
  if (pd.p) { fn(t, d.in, fl, open); return; }
  const sh = pd.sh ?? DEF_SH[pd.t] ?? 24;
  const dur = (drOv || pd.dr || 2) * stepDur;
  const f = degFreq(st, deg, sh);
  const n = st.scale.length;
  fn(t, d.in, fl, f, dur, [deg + n, deg + n + 2, deg + n + 4], st);
}

function blinkPad(d, i, t) {
  const delay = Math.max(0, (t - ctx.currentTime) * 1000);
  setTimeout(() => {
    const el = d.padEls[i];
    el.classList.remove("blink"); void el.offsetWidth; el.classList.add("blink");
  }, delay);
}
/* ================================================================
   Deck 装配与交互
   ================================================================ */
function makeDeck(side, idx) {
  const el = $("#deck" + side);
  const d = {
    side, idx, el, active: new Set(), playing: false, tick: 0, nextTick: 0,
    pitch: 0, loopLen: 16, hotcues: [null, null, null, null],
    fxType: "OFF", fxAmt: 0.35, cueOn: false,
    scratching: false, jogVel: 0, angle: 0, vu: 0,
  };
  d.padEls = $$(".pad", el);
  d.vinylEl = $(".vinyl", el);
  d.waveCv = $(".wave", el);
  d.playBtn = $(".play-btn", el);
  d.pitchVal = $(".pitch-val", el);

  d.padEls.forEach((p, i) => p.addEventListener("pointerdown", e => {
    e.preventDefault(); if (!ctx) return;
    togglePad(d, i);
  }));
  d.playBtn.addEventListener("click", () => { if (!ctx) return; d.playing ? stopDeck(d) : startDeck(d); });
  $(".sync-btn", el).addEventListener("click", e => {
    if (!ctx) return;
    d.pitch = 0; d.pitchFader.set(0.5, false); d.pitchVal.textContent = "+0.0%";
    alignDeck(d);
    e.target.classList.add("lit"); setTimeout(() => e.target.classList.remove("lit"), 350);
  });
  $(".cue-head", el).addEventListener("click", e => {
    if (!ctx) return;
    d.cueOn = !d.cueOn; d.cueGain.gain.value = d.cueOn ? 1 : 0;
    e.currentTarget.classList.toggle("lit", d.cueOn);
  });
  $$(".hotcue", el).forEach((hc, i) => {
    hc.addEventListener("click", () => {
      if (!ctx) return;
      if (d.hotcues[i] == null) {
        d.hotcues[i] = d.tick; hc.classList.add("set");
        $("span", hc).textContent = `${Math.floor(d.hotcues[i] / 16) + 1}.${(d.hotcues[i] % 16) + 1}`;
      } else { if (!d.playing) startDeck(d); d.tick = d.hotcues[i] % d.loopLen; recordPress(); }
    });
    hc.addEventListener("dblclick", () => { d.hotcues[i] = null; hc.classList.remove("set"); $("span", hc).textContent = "--"; });
  });
  $$(".llen", el).forEach(b => {
    if (b.dataset.def) b.classList.add("lit");
    b.addEventListener("click", () => {
      $$(".llen", el).forEach(x => x.classList.remove("lit")); b.classList.add("lit");
      d.loopLen = +b.dataset.len; d.tick %= d.loopLen;
    });
  });
  $(".fxsel", el).addEventListener("change", e => { if (ctx) buildFx(d, e.target.value); else d.fxType = e.target.value; });
  makeKnob($(".fx-knob", el), v => { d.fxAmt = v; if (ctx && d.fxType !== "OFF") d.fxWet.gain.value = v; });
  makeKnob($(".filter-knob", el), v => applyFilter(d, v));
  d.pitchFader = makeFader($(".pitch-fader", el), { init: 0.5 }, v => {
    d.pitch = (v - 0.5) * 16;
    d.pitchVal.textContent = (d.pitch >= 0 ? "+" : "") + d.pitch.toFixed(1) + "%";
  });
  makeJog($(".platter", el), d);
  return d;
}

function togglePad(d, i) {
  const el = d.padEls[i];
  if (d.active.has(i)) { d.active.delete(i); el.classList.remove("on"); }
  else { d.active.add(i); el.classList.add("on"); recordPress(); if (!d.playing) startDeck(d); }
}
function startDeck(d) { d.playing = true; d.playBtn.classList.add("lit"); alignDeck(d); }
function stopDeck(d) { d.playing = false; d.tick = 0; d.playBtn.classList.remove("lit"); }
function alignDeck(d) { // BPM 同步：相位对齐主节拍网格
  d.nextTick = engine.nextBeat;
  d.tick = ((engine.beatCount % Math.max(1, d.loopLen / 4)) * 4) % d.loopLen;
}
function applyFilter(d, v) {
  if (!ctx) return;
  const f = d.filter, t = ctx.currentTime;
  if (Math.abs(v) < 0.06) { f.type = "lowpass"; f.frequency.setTargetAtTime(20000, t, 0.02); f.Q.value = 0.7; }
  else if (v < 0) { f.type = "lowpass"; f.frequency.setTargetAtTime(20000 * Math.pow(150 / 20000, -v), t, 0.02); f.Q.value = 5; }
  else { f.type = "highpass"; f.frequency.setTargetAtTime(30 * Math.pow(8000 / 30, v), t, 0.02); f.Q.value = 5; }
}
function applyXfade() {
  const [a, b] = engine.decks; if (!a?.xfGain || !b?.xfGain) return;
  a.xfGain.gain.value = Math.cos(engine.xf * Math.PI / 2);
  b.xfGain.gain.value = Math.sin(engine.xf * Math.PI / 2);
}

engine.xf = 0.5;
engine.decks = [makeDeck("A", 0), makeDeck("B", 1)];

/* 混音台 */
$$(".mix-ch").forEach(chEl => {
  const d = engine.decks[chEl.dataset.ch === "A" ? 0 : 1];
  $$(".knob.eq", chEl).forEach(k => {
    const band = { hi: "eqHi", mid: "eqMid", low: "eqLow" }[k.dataset.eq];
    makeKnob(k, v => { if (ctx) d[band].gain.value = v * 14; });
  });
  makeFader($(".ch-fader", chEl), { init: 0.85 }, v => { if (ctx) d.chGain.gain.value = Math.pow(v, 1.2); });
});
makeFader($("#xfader"), { horizontal: true, init: 0.5 }, v => { engine.xf = v; if (ctx) applyXfade(); });
makeKnob($("#cueMixKnob"), v => { if (ctx) { engine.monMaster.gain.value = v; engine.monCue.gain.value = 1 - v; } });

/* BPM 主控 */
const bpmLcd = $("#bpmLcd");
const setBpm = b => { engine.bpm = clamp(b, 60, 200); bpmLcd.textContent = engine.bpm.toFixed(1); };
$("#bpmUp").addEventListener("click", () => setBpm(engine.bpm + 1));
$("#bpmDown").addEventListener("click", () => setBpm(engine.bpm - 1));

/* ---------------- 计分系统 ---------------- */
function recordPress() {
  if (!ctx || !engine.beatCount) return;
  const bd = 60 / engine.bpm;
  let frac = ((ctx.currentTime - engine.nextBeat) / bd) % 1;
  frac = ((frac % 1) + 1) % 1;
  engine.presses.push(Math.min(frac, 1 - frac)); // 0=正点 0.5=最偏
}
function settleScore() {
  const p = engine.presses; engine.presses = [];
  let acc;
  if (p.length) acc = Math.round(100 * (1 - 2 * p.reduce((a, b) => a + b, 0) / p.length));
  else acc = 90 + Math.floor(Math.random() * 9); // 无手动操作：机器循环保持律动
  acc = clamp(acc, 10, 100);
  engine.combo = acc >= 70 ? engine.combo + 1 : 0;
  const mult = 1 + engine.combo * 0.25;
  const bonus = Math.round(acc * mult);
  engine.score += bonus;
  const finalScore = engine.score, finalCombo = engine.combo;
  const [gName, gCls] = acc >= 95 ? ["PERFECT!", "g-perfect"] : acc >= 85 ? ["GREAT", "g-great"]
    : acc >= 70 ? ["GOOD", "g-good"] : ["OFF-BEAT", "g-miss"];
  const div = document.createElement("div");
  div.className = "popup " + gCls;
  div.innerHTML = `<div class="pop-card"><span class="grade">${gName}</span><span class="pts">+${bonus}</span>` +
    `<span class="meta">节奏准确度 ${acc}%${finalCombo > 1 ? ` · ${finalCombo} 连击 ×${mult.toFixed(2)}` : ""}</span></div>`;
  const card = $(".pop-card", div);
  const cols = ["var(--accent)", "var(--accent2)", "var(--warm)", "#fff"];
  const n = acc >= 95 ? 20 : acc >= 70 ? 12 : 5;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i"); s.className = "spark";
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 140;
    s.style.setProperty("--dx", Math.cos(a) * r + "px");
    s.style.setProperty("--dy", (Math.sin(a) * r - 24) + "px");
    s.style.setProperty("--c", cols[i % 4]);
    s.style.setProperty("--dl", (Math.random() * 0.18).toFixed(2) + "s");
    card.appendChild(s);
  }
  // 飞行目标：右上角计分屏中心
  const lcd = $(".score-lcd").getBoundingClientRect();
  div.style.setProperty("--tx", (lcd.left + lcd.width / 2 - innerWidth / 2) + "px");
  div.style.setProperty("--ty", (lcd.top + lcd.height / 2 - innerHeight * 0.4) + "px");
  document.body.appendChild(div);
  setTimeout(() => { // 抵达计分屏：滚分 + 弹跳
    rollScore(finalScore);
    $("#comboVal").textContent = `×${finalCombo} COMBO`;
    bump($(".score-lcd")); bump($("#comboVal"));
  }, 1600);
  setTimeout(() => div.remove(), 2000);
}
function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
let shownScore = 0;
function rollScore(target) {
  const start = shownScore, t0 = performance.now();
  const step = now => {
    const k = clamp((now - t0) / 650, 0, 1);
    shownScore = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)));
    $("#scoreVal").textContent = shownScore;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- Style Morph ---------------- */
let waveColA = "#0ff", waveColB = "#f0f";
function cacheWaveColors() {
  const cs = getComputedStyle(document.body);
  waveColA = cs.getPropertyValue("--wave").trim();
  waveColB = cs.getPropertyValue("--wave2").trim();
}
function applyStyle(key) {
  engine.styleKey = key;
  const st = STYLES[key];
  document.body.dataset.style = key;
  $("#styleName").textContent = engine.songKey ? `${st.name} × ${SONGS[engine.songKey].name}` : st.name;
  setBpm(engine.songKey ? SONGS[engine.songKey].bpm : st.bpm);
  $$(".morph-dots i").forEach(el => el.classList.toggle("on", el.dataset.s === key));
  const src = padSrc();
  engine.decks.forEach(d => {
    d.padEls.forEach((p, i) => {
      const pd = src.pads[d.idx * 8 + i];
      $("b", p).textContent = pd.l; $("i", p).textContent = pd.i;
    });
    if (ctx && d.fxType !== "OFF") buildFx(d, d.fxType); // ECHO 时值跟随新 BPM
  });
  cacheWaveColors();
  document.body.classList.add("morphing");
  setTimeout(() => document.body.classList.remove("morphing"), 550);
  if (ctx && anyPlaying()) cheer(ctx.currentTime + 0.03, 0.55);
}
$("#morphBtn").addEventListener("click", () => {
  const next = STYLE_ORDER[(STYLE_ORDER.indexOf(engine.styleKey) + 1) % 4];
  applyStyle(next);
});
$$(".morph-dots i").forEach(el => el.addEventListener("click", () => applyStyle(el.dataset.s)));

/* ---------------- 曲目选择（名曲变奏） ---------------- */
function setLoopLen(d, len) {
  d.loopLen = len; d.tick %= len;
  $$(".llen", d.el).forEach(b => b.classList.toggle("lit", +b.dataset.len === len));
}
function clearPads(d) { d.active.clear(); d.padEls.forEach(p => p.classList.remove("on")); }
function applySong(key) {
  engine.songKey = key || null;
  const sg = engine.songKey ? SONGS[engine.songKey] : null;
  engine.decks.forEach(d => {
    clearPads(d);
    setLoopLen(d, sg ? (sg.loopLen || 64) : 16); // 容纳整段乐句；自由模式回 1 小节
    if (ctx) alignDeck(d);
  });
  applyStyle(engine.styleKey); // 复用：标签 / BPM / FX 时值 / 闪屏过渡
  if (sg && ctx) { // 自动起一套编配：鼓+镲+低音 在 A 台，完整主旋律在 B 台
    const [A, B] = engine.decks;
    [0, 2, 4].forEach(i => togglePad(A, i));
    togglePad(B, 6);
  }
}
$("#songSel").addEventListener("change", e => applySong(e.target.value));

/* ---------------- 录制导出 ---------------- */
let recorder = null, recChunks = [];
$("#recBtn").addEventListener("click", e => {
  if (!ctx) return;
  const btn = e.currentTarget;
  if (recorder && recorder.state === "recording") {
    recorder.stop(); btn.classList.remove("on"); btn.textContent = "● REC";
    return;
  }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  recorder = new MediaRecorder(engine.recDest.stream, mime ? { mimeType: mime } : {});
  recChunks = [];
  recorder.ondataavailable = ev => { if (ev.data.size) recChunks.push(ev.data); };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: recorder.mimeType });
    const a = $("#dlBtn");
    a.href = URL.createObjectURL(blob);
    a.download = "dj-loop-battle." + (recorder.mimeType.includes("mp4") ? "m4a" : recorder.mimeType.includes("ogg") ? "ogg" : "webm");
    a.hidden = false;
  };
  recorder.start();
  btn.classList.add("on"); btn.textContent = "■ 停止";
});

/* ---------------- 渲染循环：波形 / VU / 转盘 / 节拍灯 ---------------- */
const leds = $$("#beatLeds i"); leds[0].classList.add("bar");
const taBuf = new Uint8Array(1024);
function fitCanvas(c) {
  const w = c.clientWidth | 0, h = c.clientHeight | 0;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
}
function drawWave(d, col) {
  const c = d.waveCv; fitCanvas(c);
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  d.ana.getByteTimeDomainData(taBuf);
  g.strokeStyle = col; g.lineWidth = 2; g.shadowBlur = 8; g.shadowColor = col;
  g.beginPath();
  for (let i = 0; i < taBuf.length; i++) {
    const x = i / taBuf.length * c.width, y = (taBuf[i] / 255) * c.height;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  // RMS → VU
  let sum = 0;
  for (let i = 0; i < taBuf.length; i++) { const v = (taBuf[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / taBuf.length) * 2.6;
  d.vu = Math.max(rms, d.vu * 0.93);
}
let masterVu = 0;
function drawVu(c, level) {
  fitCanvas(c);
  const g = c.getContext("2d"), n = 14;
  g.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < n; i++) {
    const on = level > i / n;
    const y = c.height - (i + 1) * (c.height / n);
    g.fillStyle = i > n - 3 ? (on ? "#ff4040" : "#3a1010")
      : i > n - 6 ? (on ? "#ffd040" : "#3a3210") : (on ? "#3aff70" : "#103a18");
    g.globalAlpha = on ? 1 : 0.45;
    g.fillRect(3, y + 1, c.width - 6, c.height / n - 2);
  }
  g.globalAlpha = 1;
}
let lastFrame = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = (now - lastFrame) / 1000; lastFrame = now;
  if (!ctx) return;
  const at = ctx.currentTime;
  // 节拍灯 & 16 拍结算
  while (engine.beatQueue.length && engine.beatQueue[0].t <= at) {
    const ev = engine.beatQueue.shift();
    leds.forEach((l, i) => l.classList.toggle("on", i === ev.b % 4));
    if (ev.scored) settleScore();
    engine.decks.forEach(d => { if (d.playing) $(".ring-glow", d.el).style.opacity = ev.b % 4 === 0 ? 1 : 0.85; });
  }
  engine.decks.forEach((d, i) => {
    drawWave(d, i ? waveColB : waveColA);
    if (d.playing && !d.scratching) d.angle += dt * 200 * (1 + d.pitch / 100);
    d.vinylEl.style.transform = `rotate(${d.angle}deg)`;
  });
  drawVu($("#vuA"), engine.decks[0].vu);
  drawVu($("#vuB"), engine.decks[1].vu);
  engine.masterAna.getByteTimeDomainData(taBuf);
  let s = 0; for (let i = 0; i < taBuf.length; i++) { const v = (taBuf[i] - 128) / 128; s += v * v; }
  masterVu = Math.max(Math.sqrt(s / taBuf.length) * 2.6, masterVu * 0.93);
  drawVu($("#vuM"), masterVu);
}
requestAnimationFrame(frame);

/* ---------------- 上电 ---------------- */
applyStyle("cyber");
$("#bootBtn").addEventListener("click", () => {
  $("#boot").classList.add("off");
  initAudio();
  engine.decks.forEach(d => { // 同步选区里已选的 FX
    const sel = $(".fxsel", d.el).value; if (sel !== "OFF") buildFx(d, sel);
  });
  // 开场预点亮：Deck A 的 KICK + HAT，立刻有声
  togglePad(engine.decks[0], 0);
  togglePad(engine.decks[0], 2);
});
