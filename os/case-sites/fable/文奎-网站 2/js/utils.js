export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const isTouch = window.matchMedia("(pointer: coarse)").matches;

/* -------- char-scramble text effect (the "noise text") -------- */
const GLYPHS = "!<>-_\\/[]{}—=+*^?#・0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export class Scramble {
  constructor(el) {
    this.el = el;
    this.frame = 0;
    this.queue = [];
    this.raf = null;
  }

  set(text) {
    const old = this.el.innerText;
    const len = Math.max(old.length, text.length);
    this.queue = [];
    for (let i = 0; i < len; i++) {
      const from = old[i] || "";
      const to = text[i] || "";
      const start = Math.floor(Math.random() * 14);
      const end = start + 8 + Math.floor(Math.random() * 18);
      this.queue.push({ from, to, start, end, char: "" });
    }
    cancelAnimationFrame(this.raf);
    this.frame = 0;
    this.update();
  }

  update = () => {
    let out = "";
    let done = 0;
    for (const q of this.queue) {
      if (this.frame >= q.end) {
        done++;
        out += q.to;
      } else if (this.frame >= q.start) {
        if (!q.char || Math.random() < 0.28) {
          q.char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        out += q.char;
      } else {
        out += q.from;
      }
    }
    this.el.innerText = out;
    if (done < this.queue.length) {
      this.frame++;
      this.raf = requestAnimationFrame(this.update);
    }
  };
}
