import * as THREE from "three";
import { commonGLSL } from "./glsl.js";

/* ============================================================
 * DrawTrail — the signature mouse effect.
 *
 * A chain of 128 points runs follow-the-leader physics on the CPU
 * (head pinned to the cursor's world position), is uploaded to a
 * 128×1 float texture, and a tube is rebuilt around it in the vertex
 * shader every frame. Radius scales with how fast you draw — stop
 * moving and the stroke melts away.
 *
 * The tube morphs per section:
 *   01 ink stroke · 02 fat glass tube · 03 neon wire · 04 ink
 *   05 jittery silver wire · 06 a comet blown backwards by the wind
 * ============================================================ */

const N = 128; // chain length
const R = 10;  // radial segments

export class DrawTrail {
  constructor(scene) {
    this.points = new Float32Array(N * 3);
    this.head = new THREE.Vector3();
    this.prevHead = new THREE.Vector3();
    this.speed = 0;
    this.initialized = false;

    this.data = new Float32Array(N * 4);
    this.tex = new THREE.DataTexture(this.data, N, 1, THREE.RGBAFormat, THREE.FloatType);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;

    // ring tube geometry, positions resolved in the vertex shader
    const verts = N * (R + 1);
    const aRing = new Float32Array(verts);
    const aTheta = new Float32Array(verts);
    let v = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j <= R; j++) {
        aRing[v] = i;
        aTheta[v] = (j / R) * Math.PI * 2;
        v++;
      }
    }
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < R; j++) {
        const a = i * (R + 1) + j;
        const b = a + R + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute("aRing", new THREE.BufferAttribute(aRing, 1));
    geo.setAttribute("aTheta", new THREE.BufferAttribute(aTheta, 1));
    geo.setIndex(idx);

    this.uniforms = {
      uTrail: { value: this.tex },
      uTime: { value: 0 },
      uSec: { value: [1, 0, 0, 0, 0, 0] },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uDebug: { value: new URLSearchParams(location.search).get("trail") === "debug" ? 1 : 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        attribute float aRing;
        attribute float aTheta;
        uniform sampler2D uTrail;
        uniform float uSec[6];
        uniform float uDebug;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying float vT;
        varying float vTheta;

        vec3 readP(float i) {
          return texture2D(uTrail, vec2((i + 0.5) / ${N}.0, 0.5)).xyz;
        }

        void main() {
          float i = aRing;
          vec3 p = readP(i);
          vec3 pPrev = readP(max(i - 1.0, 0.0));
          vec3 pNext = readP(min(i + 1.0, ${N}.0 - 1.0));

          vec3 dir = pPrev - pNext;
          float dl = length(dir);
          dir = dl > 1e-6 ? dir / dl : vec3(0.0, 0.0, 1.0);

          vec3 up = abs(dir.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 xa = normalize(cross(up, dir));
          vec3 ya = cross(dir, xa);

          float t01 = i / (${N}.0 - 1.0);
          vT = t01;
          vTheta = aTheta;

          // pen pressure: radius follows drawing speed (point spacing)
          float stretch = clamp(length(p - pNext) * 45.0, 0.0, 1.25);

          // per-section visible length of the tail
          float L = 0.50 * uSec[0] + 0.90 * uSec[1] + 1.00 * uSec[2]
                  + 0.60 * uSec[3] + 0.90 * uSec[4] + 0.85 * uSec[5];
          // asymmetric profile: fat near the head, long taper to the tail
          float tt = clamp(t01 / max(L, 0.05), 0.0, 1.0);
          float prof = sin(3.14159 * pow(tt, 0.6));
          prof = max(prof, smoothstep(0.0, 0.02, tt) * 0.35);
          prof *= 1.0 - smoothstep(0.92, 1.0, tt);

          // per-section base radius
          float base = 0.042 * uSec[0] + 0.150 * uSec[1] + 0.034 * uSec[2]
                     + 0.045 * uSec[3] + 0.013 * uSec[4] + 0.065 * uSec[5];

          float radius = base * prof * stretch;
          if (uDebug > 0.5) radius = 0.08 * prof * max(stretch, 0.4);

          vec3 offset = (cos(aTheta) * xa + sin(aTheta) * ya);
          vec3 world = p + offset * radius;

          vNormal = offset;
          vWorldPos = world;
          vViewDir = normalize(cameraPosition - world);
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSec[6];
        uniform float uDebug;
        uniform vec2 uResolution;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying float vT;
        varying float vTheta;
        ${commonGLSL}

        void main() {
          float w[6];
          for (int i = 0; i < 6; i++) w[i] = uSec[i];

          vec3 n = normalize(vNormal);
          vec3 v = normalize(vViewDir);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 L1 = normalize(vec3(0.55, 1.0, 0.65));
          float spec = pow(max(dot(reflect(-L1, n), v), 0.0), 60.0);

          // -- ink stroke (sections 1 & 4)
          vec3 ink = vec3(0.05) + spec * 1.1;
          ink += hsv2rgb(vec3(uTime * 0.08 + vT * 0.5, 0.6, 1.0)) * fres * 0.45 * w[0];

          // -- fat glass tube (section 2)
          vec2 suv = gl_FragCoord.xy / uResolution;
          vec2 off = n.xy * 0.22 * (0.4 + fres);
          vec3 glass;
          glass.r = bgColor(suv - off * 0.88, uTime, w).r;
          glass.g = bgColor(suv - off * 1.00, uTime, w).g;
          glass.b = bgColor(suv - off * 1.14, uTime, w).b;
          glass *= vec3(0.95, 0.97, 1.0) * (1.0 - fres * 0.65);
          glass += spec * 2.0;
          glass += hsv2rgb(vec3(fres * 1.8 + uTime * 0.08 + vT * 1.6, 0.55, 1.0)) * fres * 0.55;

          // -- neon wire (section 3)
          float pulse = 0.7 + 1.0 * smoothstep(0.5, 1.0, sin(vT * 46.0 - uTime * 7.0));
          vec3 neon = mix(vec3(0.45, 0.9, 1.0), vec3(1.0), fres) * 2.4 * pulse;

          // -- silver wire (section 5)
          vec3 silver = vec3(0.7) + spec * 2.2 + fres * 0.3;

          // -- comet (section 6) — white-hot head, prismatic ribbon tail
          float flick = 0.85 + 0.35 * hash21(vec2(floor(vT * 70.0), floor(uTime * 24.0)));
          // multicolor cosine palette flowing down the stroke,
          // with a touch of iridescence around the tube
          float pt = vT * 1.6 - uTime * 0.35 + sin(vTheta + uTime) * 0.07;
          vec3 comet = 0.55 + 0.45 * cos(6.28318 * (pt + vec3(0.0, 0.33, 0.67)));
          comet = pow(comet, vec3(1.4)) * 2.1;
          comet = mix(vec3(2.4, 2.3, 2.0), comet, smoothstep(0.0, 0.20, vT));
          comet *= flick;
          comet += spec * 0.9 + fres * comet * 0.4;

          vec3 col = ink * (w[0] + w[3]) + glass * w[1] + neon * w[2]
                   + silver * w[4] + comet * w[5];

          float alpha = 1.0 * (w[0] + w[3]) + 0.96 * w[1] + 0.95 * w[2] + 0.92 * w[4]
                      + (1.0 - pow(vT, 1.4) * 0.9) * w[5];

          if (uDebug > 0.5) {
            col = vec3(1.0, 0.0, 0.6);
            alpha = 1.0;
          }
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  update(dt, cursorWorld, weights, t, width, height, dpr) {
    const pts = this.points;
    if (!this.initialized) {
      for (let i = 0; i < N; i++) {
        pts[i * 3] = cursorWorld.x;
        pts[i * 3 + 1] = cursorWorld.y;
        pts[i * 3 + 2] = cursorWorld.z;
      }
      this.head.copy(cursorWorld);
      this.prevHead.copy(cursorWorld);
      this.sampleAccum = 0;
      this.initialized = true;
    }

    // springy head
    const hk = 1 - Math.exp(-14 * dt);
    this.head.lerp(cursorWorld, hk);
    this.speed = this.head.distanceTo(this.prevHead) / Math.max(dt, 1e-4);
    this.prevHead.copy(this.head);

    /* The chain is a sampled HISTORY of the head (one point every 16 ms,
     * ~2 s of gesture), so a drawn circle stays a circle hanging in space.
     * Standing still pushes duplicate samples and the stroke melts away,
     * because the tube radius comes from point spacing. */
    const STEP = 0.016;
    this.sampleAccum = Math.min(this.sampleAccum + dt, STEP * 4);
    while (this.sampleAccum >= STEP) {
      this.sampleAccum -= STEP;
      pts.copyWithin(3, 0, (N - 1) * 3);
    }
    pts[0] = this.head.x;
    pts[1] = this.head.y;
    pts[2] = this.head.z;

    // gentle relaxation irons out pointer kinks
    const w = weights;
    const relax = 1 - Math.exp(-2.6 * dt);
    // outro: the wind carries the stroke away behind the runner
    const drift = w[5];
    const dx = 1.1 * dt * drift;
    const dy = -0.45 * dt * drift;
    const dz = 1.5 * dt * drift;
    const jitter = w[4] * 0.012;

    for (let i = 1; i < N; i++) {
      const o = i * 3;
      pts[o] += (pts[o - 3] - pts[o]) * relax;
      pts[o + 1] += (pts[o - 2] - pts[o + 1]) * relax;
      pts[o + 2] += (pts[o - 1] - pts[o + 2]) * relax;
      if (drift > 0.001) {
        const fall = i / N;
        pts[o] += dx * fall;
        pts[o + 1] += dy * fall;
        pts[o + 2] += dz * fall;
      }
      if (jitter > 0.0001) {
        pts[o] += (Math.sin(t * 31.0 + i * 2.7) + Math.sin(t * 17.3 + i)) * jitter * 0.5;
        pts[o + 1] += Math.sin(t * 27.0 + i * 1.9) * jitter * 0.5;
      }
    }

    for (let i = 0; i < N; i++) {
      this.data[i * 4] = pts[i * 3];
      this.data[i * 4 + 1] = pts[i * 3 + 1];
      this.data[i * 4 + 2] = pts[i * 3 + 2];
      this.data[i * 4 + 3] = 1;
    }
    this.tex.needsUpdate = true;

    this.uniforms.uTime.value = t;
    for (let i = 0; i < 6; i++) this.uniforms.uSec.value[i] = w[i];
    this.uniforms.uResolution.value.set(width * dpr, height * dpr);
  }
}

/* ============================================================
 * Sparks — embers shed by the comet in the outro
 * ============================================================ */
const SPARKS = 260;

export class Sparks {
  constructor(scene) {
    this.pos = new Float32Array(SPARKS * 3);
    this.vel = new Float32Array(SPARKS * 3);
    this.life = new Float32Array(SPARKS);
    this.seed = new Float32Array(SPARKS);
    this.cursor = 0;
    for (let i = 0; i < SPARKS; i++) this.seed[i] = Math.random();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aLife", new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(this.seed, 1));

    this.uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSeed;
        varying float vLife;
        varying float vSeed;
        void main() {
          vLife = aLife;
          vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (5.0 + aSeed * 9.0) * aLife * (4.2 / max(-mv.z, 0.1));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying float vLife;
        varying float vSeed;
        void main() {
          if (vLife <= 0.001) discard;
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          float tw = 0.6 + 0.4 * sin(uTime * (14.0 + vSeed * 20.0) + vSeed * 40.0);
          // confetti embers share the comet's palette
          vec3 c = 0.55 + 0.45 * cos(6.28318 * (vSeed * 1.7 + uTime * 0.18 + vec3(0.0, 0.33, 0.67)));
          c = pow(c, vec3(1.3)) * 1.9;
          c = mix(c, vec3(1.9), smoothstep(0.75, 1.0, vLife) * 0.7);
          gl_FragColor = vec4(c, a * pow(vLife, 1.4) * tw * uOpacity);
        }
      `,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    scene.add(this.points);
  }

  emit(origin, speed) {
    const count = Math.min(4, Math.floor(speed * 1.5) + 1);
    for (let c = 0; c < count; c++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % SPARKS;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.12;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.12;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.12;
      this.vel[i * 3] = 0.7 + (Math.random() - 0.5) * 1.4;
      this.vel[i * 3 + 1] = 0.25 + (Math.random() - 0.5) * 0.9;
      this.vel[i * 3 + 2] = 1.6 + Math.random() * 1.2;
      this.life[i] = 1;
    }
  }

  update(dt, t, weight, trailHead, trailSpeed) {
    this.points.visible = weight > 0.005;
    this.uniforms.uTime.value = t;
    this.uniforms.uOpacity.value = weight;
    if (!this.points.visible) return;

    if (trailSpeed > 0.4) this.emit(trailHead, trailSpeed);

    for (let i = 0; i < SPARKS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * (0.9 + this.seed[i] * 0.6);
      const o = i * 3;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.vel[o + 1] -= 0.5 * dt; // embers sag
      this.vel[o] *= 0.995;
      this.vel[o + 2] *= 0.995;
      // turbulence
      this.pos[o] += Math.sin(t * 9.0 + i * 1.7) * 0.0035;
      this.pos[o + 1] += Math.cos(t * 7.0 + i * 2.3) * 0.0030;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
  }
}

/* ============================================================
 * PencilTrail — 2D graphite squiggle, section 1 only
 * (a nod to the original's pencil that sketches over the intro)
 * ============================================================ */
const MAX_POINTS = 90;
const LIFE = 0.9;

export class PencilTrail {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.points = [];
    this.lastJitter = 0;

    const maxVerts = MAX_POINTS * 2;
    this.positions = new Float32Array(maxVerts * 3);
    this.alphas = new Float32Array(maxVerts);
    this.along = new Float32Array(maxVerts * 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlong", new THREE.BufferAttribute(this.along, 2).setUsage(THREE.DynamicDrawUsage));

    const idx = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.geo = geo;

    this.uniforms = {
      uTime: { value: 0 },
      uStrength: { value: 1 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute vec2 aAlong;
        varying float vAlpha;
        varying vec2 vAlong;
        void main() {
          vAlpha = aAlpha;
          vAlong = aAlong;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uStrength;
        varying float vAlpha;
        varying vec2 vAlong;
        float hash21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
        void main() {
          float grain = hash21(vec2(floor(vAlong.x * 220.0), floor(vAlong.y * 5.0) + floor(uTime * 12.0)));
          float a = vAlpha * (0.45 + grain * 0.55);
          a *= smoothstep(1.0, 0.6, abs(vAlong.y * 2.0 - 1.0) + grain * 0.35);
          gl_FragColor = vec4(vec3(0.07), a * 0.95 * uStrength);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.geo.setDrawRange(0, 0);
  }

  addPoint(x, y, now) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 2) return;
    this.points.push({ x, y, t: now, jx: 0, jy: 0 });
    if (this.points.length > MAX_POINTS) this.points.shift();
  }

  update(now, width, height, strength) {
    this.uniforms.uTime.value = now;
    this.uniforms.uStrength.value = strength;
    this.mesh.visible = strength > 0.01;

    while (this.points.length && now - this.points[0].t > LIFE) this.points.shift();
    const pts = this.points;
    const n = pts.length;
    if (n < 2 || !this.mesh.visible) {
      this.geo.setDrawRange(0, 0);
      return;
    }

    if (now - this.lastJitter > 0.085) {
      this.lastJitter = now;
      for (const p of pts) {
        p.jx = (Math.random() - 0.5) * 3.2;
        p.jy = (Math.random() - 0.5) * 3.2;
      }
    }

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(n - 1, i + 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      const age = (now - p.t) / LIFE;
      const head = i / (n - 1);
      const wpx = (2.2 + 3.4 * Math.sin(head * Math.PI)) * (1 - age * 0.7);
      const px = p.x + p.jx;
      const py = p.y + p.jy;

      const ox = (-dy * wpx) / width * 2;
      const oy = (dx * wpx) / height * 2;
      const nx = (px / width) * 2 - 1;
      const ny = -((py / height) * 2 - 1);

      const v = i * 2;
      this.positions[v * 3 + 0] = nx + ox;
      this.positions[v * 3 + 1] = ny + oy;
      this.positions[(v + 1) * 3 + 0] = nx - ox;
      this.positions[(v + 1) * 3 + 1] = ny - oy;

      const a = (1 - age) * Math.min(1, head * 4);
      this.alphas[v] = a;
      this.alphas[v + 1] = a;
      this.along[v * 2 + 0] = head;
      this.along[v * 2 + 1] = 0;
      this.along[(v + 1) * 2 + 0] = head;
      this.along[(v + 1) * 2 + 1] = 1;
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aAlong.needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 6);
  }
}

/* subtle fullscreen grain + vignette overlay (cheap "post processing") */
export class GrainOverlay {
  constructor(scene) {
    this.uniforms = { uTime: { value: 0 } };
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          float hash21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
          void main() {
            float vig = smoothstep(1.25, 0.45, length(vUv - 0.5) * 1.6);
            float g = hash21(vUv * 717.0 + fract(uTime * 61.7));
            gl_FragColor = vec4(vec3(g), 0.05);
            gl_FragColor.a += (1.0 - vig) * 0.10;
            gl_FragColor.rgb *= vig;
          }
        `,
      })
    );
    quad.frustumCulled = false;
    quad.renderOrder = 999;
    scene.add(quad);
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }
}
