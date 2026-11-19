import { clamp, Scramble, isTouch } from "./utils.js";

const SECTION_NAMES = ["GRAPHIC", "FLEXIBLE", "TECHNICAL", "FRIENDLY", "VISIONARY", "NEXT"];
const CYCLE_GLYPHS = "!<>-_\\/[]{}—=+*^?#・0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/* split a headline into per-char spans: outer .ch handles the staggered
 * entrance, inner .ci carries each section's looping personality */
function splitChars(el) {
  const nodes = [...el.childNodes];
  el.textContent = "";
  const chars = [];
  let idx = 0;
  for (const node of nodes) {
    if (node.nodeName === "BR") {
      el.appendChild(document.createElement("br"));
      continue;
    }
    for (const c of node.textContent) {
      const outer = document.createElement("span");
      outer.className = "ch";
      outer.style.setProperty("--i", idx++);
      const inner = document.createElement("span");
      inner.className = "ci";
      inner.textContent = c;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (c.trim()) chars.push(inner);
    }
  }
  return chars;
}

/* roll random glyphs before settling on the real character */
function cycleChars(chars) {
  chars.forEach((ci, i) => {
    const real = ci.dataset.real || (ci.dataset.real = ci.textContent);
    const end = performance.now() + 160 + i * 38;
    const timer = setInterval(() => {
      if (performance.now() >= end) {
        ci.textContent = real;
        clearInterval(timer);
      } else {
        ci.textContent = CYCLE_GLYPHS[Math.floor(Math.random() * CYCLE_GLYPHS.length)];
      }
    }, 34);
  });
}

export class UI {
  constructor() {
    this.counterEl = document.getElementById("counter");
    this.counterFx = new Scramble(this.counterEl);
    this.secs = [...document.querySelectorAll(".sec")];
    this.titleChars = this.secs.map((s) => splitChars(s.querySelector(".title")));

    // giant ghost section number behind each headline
    this.secs.forEach((s, i) => {
      const g = document.createElement("span");
      g.className = "ghost blend";
      g.textContent = String(i + 1).padStart(2, "0");
      s.prepend(g);
    });

    // glitch copies for the TECHNICAL headline
    const techTitle = this.secs[2].querySelector(".title");
    for (const cls of ["glitch-a", "glitch-b"]) {
      const copy = document.createElement("span");
      copy.className = `glitch-copy ${cls}`;
      copy.setAttribute("aria-hidden", "true");
      copy.textContent = techTitle.dataset.text;
      techTitle.appendChild(copy);
    }

    this.marquee = document.getElementById("marquee");
    this.backtext = document.getElementById("backtext");
    this.scrollhint = document.getElementById("scrollhint");
    this.progressDot = document.querySelector(".progress-dot");
    this.handnote = document.getElementById("handnote");
    this.cursor = document.getElementById("cursor");
    this.activeIndex = -1;
    this.noteShown = false;
    this.noteHidden = false;

    document.getElementById("totop").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* loading screen */
  async runLoading(fast) {
    const overlay = document.getElementById("loading");
    const pctEl = document.getElementById("loadingPct");
    const barEl = document.getElementById("loadingBar");
    const logoFx = new Scramble(document.getElementById("loadingLogo"));
    logoFx.set("BAKU is...");

    const t0 = performance.now();
    const minTime = fast ? 120 : 1700;

    await new Promise((resolve) => {
      const tick = () => {
        const el = performance.now() - t0;
        const p = clamp(el / minTime, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        pctEl.textContent = String(Math.floor(eased * 100)).padStart(3, "0");
        barEl.style.transform = `scaleX(${eased})`;
        if (p >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    await document.fonts.ready.catch(() => {});
    pctEl.textContent = "100";
    overlay.classList.add("done");
    this.enabled = true;
    setTimeout(() => overlay.remove(), fast ? 200 : 1200);
  }

  update(s, weights) {
    // headlines
    for (let i = 0; i < this.secs.length; i++) {
      const w = weights[i];
      const el = this.secs[i];
      if (w > 0.005) {
        el.style.opacity = Math.pow(w, 1.4).toFixed(3);
        el.style.transform = `translateY(${((1 - w) * (s > i ? -1 : 1) * 60).toFixed(1)}px)`;
      } else {
        el.style.opacity = 0;
      }
    }

    // overlays tied to specific sections
    this.marquee.style.opacity = (weights[1] * 0.45).toFixed(3);
    this.backtext.style.opacity = (weights[2] * 0.16).toFixed(3);

    // counter scramble + per-char headline reveal on section change
    const idx = clamp(Math.round(s), 0, 5);
    if (this.enabled && idx !== this.activeIndex) {
      this.activeIndex = idx;
      this.counterFx.set(`0${idx + 1} — ${SECTION_NAMES[idx]}`);
      this.secs.forEach((el, i) => el.classList.toggle("is-in", i === idx));
      cycleChars(this.titleChars[idx]);
    }

    // scroll hint + progress
    this.scrollhint.style.opacity = s < 0.15 ? 1 : 0;
    this.progressDot.style.top = `${(clamp(s / 5, 0, 1) * 100).toFixed(2)}%`;
  }

  /* "click me!" hand note near the creature */
  showNote(x, y) {
    if (this.noteHidden || isTouch) return;
    this.handnote.style.left = `${x}px`;
    this.handnote.style.top = `${y}px`;
    if (!this.noteShown) {
      this.noteShown = true;
      this.handnote.style.opacity = 0.9;
    }
  }
  hideNote() {
    this.noteHidden = true;
    this.handnote.style.opacity = 0;
  }

  setCursor(x, y, hover) {
    this.cursor.style.transform = `translate(${x}px, ${y}px)`;
    this.cursor.classList.toggle("is-hover", hover);
  }
}
