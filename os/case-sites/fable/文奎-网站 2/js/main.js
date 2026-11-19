import * as THREE from "three";
import { clamp, lerp, damp, smoothstep, isTouch } from "./utils.js";
import { Background } from "./bg.js";
import { Baku } from "./baku.js";
import { GlyphField } from "./glyphs.js";
import { GlassPanes, TechField, VisionRing, OutroField } from "./sections.js";
import { PencilTrail, DrawTrail, Sparks, GrainOverlay } from "./trail.js";
import { UI } from "./ui.js";

const params = new URLSearchParams(location.search);
const FAST = params.has("fast");

/* scroll choreography: one pose per section, eased in between */
const POSES = [
  { p: [0, -0.15, 0], s: 1.0, ry: -0.45, rx: 0.02, turn: 0.16, ground: -1.12 },
  { p: [0.45, 0.1, 0.3], s: 0.92, ry: 0.3, rx: -0.04, turn: 0.1, ground: -1.2 },
  { p: [-0.95, 0.0, 0], s: 0.85, ry: 1.0, rx: 0.05, turn: 0.06, ground: -1.2 },
  { p: [0, 0.45, -0.7], s: 0.52, ry: -0.3, rx: 0.0, turn: 0.3, ground: -1.05 },
  { p: [0, 0.02, -0.35], s: 1.02, ry: 2.4, rx: -0.02, turn: 0.24, ground: -1.25 },
  { p: [0, -0.72, 0.35], s: 0.6, ry: Math.PI / 2, rx: 0.0, turn: 0.0, ground: -1.16 },
];

class App {
  constructor() {
    this.canvas = document.getElementById("gl");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    this.camera.position.set(0, 0, 5.4);

    this.bg = new Background();
    this.baku = new Baku(this.scene);
    this.confetti = new GlyphField(this.scene, {
      count: 42,
      types: [0, 0, 1, 1, 2, 3],
      layout: "orbit",
      color: new THREE.Color(0x101014),
      baseScale: 0.2,
    });
    this.crowd = new GlyphField(this.scene, {
      count: 96,
      types: [4],
      layout: "crowd",
      color: new THREE.Color(0x101014),
      baseScale: 0.42,
    });
    this.glass = new GlassPanes(this.scene);
    this.tech = new TechField(this.scene);
    this.vision = new VisionRing(this.scene);
    this.outro = new OutroField(this.scene);

    this.trail = new PencilTrail();
    this.drawTrail = new DrawTrail(this.scene);
    this.sparks = new Sparks(this.scene);
    this.grain = new GrainOverlay(this.trail.scene);

    // comrades running alongside in the outro (share the baku mesh)
    this.comrades = [];
    for (const def of [
      { p: [-1.5, -0.85, -0.7], s: 0.38, phase: 1.7 },
      { p: [1.55, -0.9, -1.6], s: 0.28, phase: 3.4 },
    ]) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(this.baku.mesh.geometry, this.baku.mesh.material);
      m.frustumCulled = false;
      g.add(m);
      g.position.set(...def.p);
      g.rotation.y = Math.PI / 2;
      g.userData = def;
      g.visible = false;
      this.scene.add(g);
      this.comrades.push(g);
    }

    this.ui = new UI();

    // state
    this.scroll = 0;
    this.scrollTarget = 0;
    this.mouse = new THREE.Vector2(0, 0);
    this.mousePx = { x: innerWidth / 2, y: innerHeight / 2 };
    this.cursorWorld = new THREE.Vector3(0, 0, 2);
    this.reveal = FAST ? 1 : 0;
    this.started = false;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.weights = [1, 0, 0, 0, 0, 0];
    this.raycaster = new THREE.Raycaster();
    this.hover = false;

    this.bindEvents();
    this.resize();

    // ?s=N → jump straight to a section (used by the screenshot rig)
    if (params.has("s")) {
      const target = parseFloat(params.get("s")) || 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, target * innerHeight);
        this.scroll = this.scrollTarget = target;
      });
    }

    this.ui.runLoading(FAST).then(() => {
      this.started = true;
    });

    this.renderer.setAnimationLoop(() => this.tick());
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    window.addEventListener("pointermove", (e) => {
      this.mousePx.x = e.clientX;
      this.mousePx.y = e.clientY;
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = -((e.clientY / innerHeight) * 2 - 1);
      this.trail.addPoint(e.clientX, e.clientY, this.time);
    });

    window.addEventListener("pointerdown", () => {
      if (this.hover || isTouch) {
        if (this.baku.jump()) this.ui.hideNote();
      }
    });
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  pose(s) {
    const i = clamp(Math.floor(s), 0, 5);
    const j = clamp(i + 1, 0, 5);
    const f = smoothstep(0, 1, clamp(s - i, 0, 1));
    const a = POSES[i];
    const b = POSES[j];
    const turn = lerp(a.turn, b.turn, f);
    return {
      x: lerp(a.p[0], b.p[0], f) + this.mouse.x * 0.06,
      y: lerp(a.p[1], b.p[1], f),
      z: lerp(a.p[2], b.p[2], f),
      s: lerp(a.s, b.s, f) * this.reveal01(),
      ry: lerp(a.ry, b.ry, f) + this.time * turn + this.mouse.x * 0.12,
      rx: lerp(a.rx, b.rx, f) - this.mouse.y * 0.07,
      shadowY: lerp(a.ground, b.ground, f),
    };
  }

  reveal01() {
    return 1 - Math.pow(1 - this.reveal, 2);
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;

    // smooth scroll
    this.scrollTarget = clamp(window.scrollY / innerHeight, 0, 5);
    this.scroll = damp(this.scroll, this.scrollTarget, 5.5, dt);
    const s = this.scroll;

    // intro reveal once loading is done
    if (this.started) this.reveal = Math.min(this.reveal + dt * 0.55, 1);

    // section weights
    for (let i = 0; i < 6; i++) this.weights[i] = clamp(1 - Math.abs(s - i), 0, 1);
    const w = this.weights;

    // camera drift + parallax + run-shake in the outro
    this.camera.position.x = damp(this.camera.position.x, this.mouse.x * 0.3, 4, dt);
    this.camera.position.y = damp(this.camera.position.y, this.mouse.y * 0.18, 4, dt);
    this.camera.position.z = 5.4 - w[5] * 0.6 + w[3] * 0.3;
    this.camera.position.y += (Math.sin(t * 7.1) * 0.012 + Math.sin(t * 13.7) * 0.005) * w[5];
    this.camera.lookAt(0, 0, 0);
    // per-section dutch tilt
    this.camera.rotation.z +=
      -0.028 * w[1] + 0.022 * w[2] - 0.016 * w[4] + Math.sin(t * 7.1) * 0.004 * w[5];

    // cursor → world point for raycast + the tech-section light
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.cursorWorld.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, 4.0);
    const hit = this.raycaster.intersectObject(this.baku.proxy, false);
    this.hover = hit.length > 0;

    // modules
    this.bg.update(t, w);
    this.baku.update({
      t, dt,
      weights: w,
      pose: this.pose(s),
      cursorWorld: this.cursorWorld,
      width: innerWidth,
      height: innerHeight,
      dpr: this.dpr,
      reveal: this.reveal01(),
    });
    this.confetti.update(t, w[0] * this.reveal01());
    this.crowd.update(t, w[3]);
    this.glass.update(t, w, innerWidth, innerHeight, this.dpr);
    this.tech.update(t, w);
    this.vision.update(t, w);
    this.outro.update(t, w);

    // mouse effects: 2D pencil (section 1 only) + the 3D draw-trail tube
    this.trail.update(t, innerWidth, innerHeight, w[0] * this.reveal01());
    this.drawTrail.update(dt, this.cursorWorld, w, t, innerWidth, innerHeight, this.dpr);
    this.sparks.update(dt, t, w[5], this.drawTrail.head, this.drawTrail.speed);
    this.grain.update(t);

    // comrades in the outro
    for (const c of this.comrades) {
      const { s, phase } = c.userData;
      c.visible = w[5] > 0.01;
      if (!c.visible) continue;
      c.scale.setScalar(s * (0.2 + 0.8 * w[5]));
      c.children[0].position.y = Math.abs(Math.sin(t * 7.0 + phase)) * 0.3;
      c.rotation.z = Math.sin(t * 7.0 + phase) * 0.06;
    }

    // DOM
    this.ui.update(s, w);
    this.ui.setCursor(this.mousePx.x, this.mousePx.y, this.hover);
    if (this.hover && w[0] > 0.5) {
      this.ui.showNote(this.mousePx.x + 26, this.mousePx.y - 44);
    }

    // render: bg → world → overlay
    this.renderer.clear();
    this.renderer.render(this.bg.scene, this.bg.camera);
    this.renderer.render(this.scene, this.camera);
    this.renderer.render(this.trail.scene, this.trail.camera);
  }
}

window.__app = new App();
