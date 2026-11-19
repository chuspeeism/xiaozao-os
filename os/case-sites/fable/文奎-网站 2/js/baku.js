import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { commonGLSL } from "./glsl.js";

/*
 * The dream-eating tapir, sculpted procedurally from metaballs and baked
 * once into a static geometry. One ShaderMaterial morphs it between the
 * section looks: glossy black → glass → white wireframe → dawn silhouette.
 */

const BALLS = [
  // [x, y, z, strength]            field space, center 0.5, +x = forward
  [0.435, 0.510, 0.5, 1.00], // rump
  [0.520, 0.520, 0.5, 0.92], // chest
  [0.600, 0.565, 0.5, 0.42], // head
  [0.652, 0.590, 0.5, 0.17], // brow
  [0.676, 0.582, 0.5, 0.115], // trunk base
  [0.706, 0.568, 0.5, 0.085], // trunk mid
  [0.730, 0.546, 0.5, 0.062], // trunk tip (drooping)
  [0.747, 0.520, 0.5, 0.045],
  [0.598, 0.648, 0.462, 0.048], // ears
  [0.598, 0.648, 0.538, 0.048],
  [0.452, 0.402, 0.452, 0.130], // legs
  [0.452, 0.402, 0.548, 0.130],
  [0.562, 0.402, 0.458, 0.115],
  [0.562, 0.402, 0.542, 0.115],
  [0.398, 0.530, 0.5, 0.045], // tail nub
];

/* Laplacian relaxation — irons out the marching-cubes lumpiness so the
 * studio highlights read like a polished sculpt. */
function laplacianSmooth(geo, iterations, lambda) {
  const posAttr = geo.getAttribute("position");
  const index = geo.index.array;
  const n = posAttr.count;
  const neighbors = Array.from({ length: n }, () => []);
  const seen = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < index.length; i += 3) {
    const tri = [index[i], index[i + 1], index[i + 2]];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        if (a !== b && !seen[tri[a]].has(tri[b])) {
          seen[tri[a]].add(tri[b]);
          neighbors[tri[a]].push(tri[b]);
        }
      }
    }
  }
  const src = Float32Array.from(posAttr.array);
  const dst = new Float32Array(src.length);
  for (let it = 0; it < iterations; it++) {
    for (let v = 0; v < n; v++) {
      const nb = neighbors[v];
      const o = v * 3;
      if (!nb.length) {
        dst[o] = src[o];
        dst[o + 1] = src[o + 1];
        dst[o + 2] = src[o + 2];
        continue;
      }
      let ax = 0, ay = 0, az = 0;
      for (const u of nb) {
        ax += src[u * 3];
        ay += src[u * 3 + 1];
        az += src[u * 3 + 2];
      }
      ax /= nb.length;
      ay /= nb.length;
      az /= nb.length;
      dst[o] = src[o] + (ax - src[o]) * lambda;
      dst[o + 1] = src[o + 1] + (ay - src[o + 1]) * lambda;
      dst[o + 2] = src[o + 2] + (az - src[o + 2]) * lambda;
    }
    src.set(dst);
  }
  posAttr.array.set(src);
  posAttr.needsUpdate = true;
}

function bakeGeometry() {
  const mc = new MarchingCubes(96, new THREE.MeshBasicMaterial(), false, false, 300000);
  mc.isolation = 70;
  mc.reset();
  for (const [x, y, z, s] of BALLS) mc.addBall(x, y, z, s, 14);
  mc.update();

  const src = mc.geometry;
  let count = src.drawRange.count;
  const posArr = src.getAttribute("position").array;
  if (!isFinite(count) || count <= 0) {
    count = posArr.length / 3;
    while (count > 3 && posArr[(count - 1) * 3] === 0 && posArr[(count - 1) * 3 + 1] === 0) count -= 3;
  }

  const pos = new Float32Array(posArr.slice(0, count * 3));
  let geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  // weld the triangle soup, relax it, rebuild smooth normals
  geo = mergeVertices(geo, 1e-3);
  laplacianSmooth(geo, 4, 0.5);
  geo.computeVertexNormals();

  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  geo.translate(-c.x, -c.y - 0.06, -c.z);
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  const k = 2.35 / size.x;
  geo.scale(k, k, k);

  // back to a soup for barycentric wireframe + per-triangle dissolve seeds
  geo = geo.toNonIndexed();
  const vcount = geo.getAttribute("position").count;
  const bary = new Float32Array(vcount * 3);
  const seed = new Float32Array(vcount);
  for (let i = 0; i < vcount; i += 3) {
    bary.set([1, 0, 0, 0, 1, 0, 0, 0, 1], i * 3);
    const r = Math.random();
    seed[i] = seed[i + 1] = seed[i + 2] = r;
  }
  geo.setAttribute("aBary", new THREE.BufferAttribute(bary, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.computeBoundingSphere();

  mc.geometry.dispose();
  return geo;
}

export class Baku {
  constructor(scene) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group(); // jump/bob, separate from posed transform
    this.group.add(this.inner);
    scene.add(this.group);

    this.uniforms = {
      uTime: { value: 0 },
      uSec: { value: [1, 0, 0, 0, 0, 0] },
      uGlass: { value: 0 },
      uWire: { value: 0 },
      uReveal: { value: 0 },
      uSquash: { value: 0 },
      uCursor: { value: new THREE.Vector3(0, 0, 2) },
      uCursorPow: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        attribute vec3 aBary;
        attribute float aSeed;
        uniform float uTime;
        uniform float uSquash;
        uniform float uReveal;
        varying vec3 vNormal;
        varying vec3 vNv;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vBary;
        varying float vSeed;

        void main() {
          vec3 p = position;
          // breathing
          p *= 1.0 + sin(uTime * 1.5) * 0.012;
          // jump squash & stretch
          p.y *= 1.0 + uSquash;
          p.xz *= 1.0 - uSquash * 0.55;
          // intro reveal: triangles converge from a noisy shell
          float rv = clamp(uReveal * 1.6 - aSeed * 0.6, 0.0, 1.0);
          rv = 1.0 - pow(1.0 - rv, 3.0);
          p = mix(normalize(position) * (1.8 + aSeed * 2.2), p, rv);

          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vNv = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - wp.xyz);
          vBary = aBary;
          vSeed = aSeed;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSec[6];
        uniform float uGlass;
        uniform float uWire;
        uniform vec3 uCursor;
        uniform float uCursorPow;
        uniform vec2 uResolution;
        varying vec3 vNormal;
        varying vec3 vNv;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vBary;
        varying float vSeed;
        ${commonGLSL}

        float edgeFactor(vec3 b) {
          vec3 d = fwidth(b);
          vec3 a = smoothstep(vec3(0.0), d * 1.4, b);
          return 1.0 - min(min(a.x, a.y), a.z);
        }

        void main() {
          float w[6];
          for (int i = 0; i < 6; i++) w[i] = uSec[i];

          vec3 n = normalize(vNormal);
          vec3 v = normalize(vViewDir);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

          // ---- glossy black body ----
          vec3 L1 = normalize(vec3(0.55, 1.0, 0.65));
          vec3 L2 = normalize(vec3(-0.7, 0.2, -0.4));
          vec3 base = vec3(0.045, 0.045, 0.055);
          base *= 0.55 + 0.45 * max(dot(n, L1), 0.0);
          float spec = pow(max(dot(reflect(-L1, n), v), 0.0), 70.0) * 0.95
                     + pow(max(dot(reflect(-L2, n), v), 0.0), 24.0) * 0.18;
          // fake env bleed: sample the procedural bg along the normal
          vec3 env = bgColor(n.xy * 0.5 + 0.5, uTime, w);
          base += env * 0.10 * (0.3 + fres);
          base += vec3(spec);

          // studio "matcap" highlights in view space — the polished-sculpt look
          vec3 nv = normalize(vNv);
          vec2 m = nv.xy;
          float h1 = exp(-dot(m - vec2(-0.32, 0.58), m - vec2(-0.32, 0.58)) / 0.09) * 0.30; // soft key
          float h2 = exp(-dot(m - vec2(0.52, 0.18), m - vec2(0.52, 0.18)) / 0.012) * 0.85;  // sharp kicker
          float h3 = exp(-dot(m - vec2(0.05, -0.62), m - vec2(0.05, -0.62)) / 0.045) * 0.10; // floor bounce
          base += vec3(h1 + h2 + h3) * (1.0 - uWire * 0.9) * (1.0 - uGlass * 0.6);

          // per-section rim light
          vec3 rimRainbow = hsv2rgb(vec3(uTime * 0.08 + vWorldPos.y * 0.18, 0.65, 1.0));
          vec3 rimCol = rimRainbow * w[0]
                      + vec3(0.9) * w[1]
                      + vec3(0.4, 0.9, 1.0) * 0.4 * w[2]
                      + vec3(0.55) * w[3]
                      + vec3(0.95) * w[4]
                      + vec3(1.0, 0.45, 0.2) * 0.85 * w[5];
          base += rimCol * fres * 0.9;

          // dawn back-light from above-behind in the last section
          base += vec3(1.0, 0.5, 0.25) * pow(max(dot(n, normalize(vec3(0.2, 0.6, -1.0))), 0.0), 3.0) * w[5] * 0.55;

          // cursor light (dark tech section)
          vec3 ld = uCursor - vWorldPos;
          float att = 1.0 / (1.0 + dot(ld, ld) * 0.5);
          base += vec3(0.5, 0.85, 1.0) * pow(max(dot(n, normalize(ld)), 0.0), 2.0) * att * uCursorPow * 1.4;

          float alpha = 1.0;

          // ---- glass ----
          if (uGlass > 0.001) {
            vec2 suv = gl_FragCoord.xy / uResolution;
            vec2 off = n.xy * 0.16 * (0.4 + fres);
            vec3 glass;
            glass.r = bgColor(suv - off * 0.90, uTime, w).r;
            glass.g = bgColor(suv - off * 1.00, uTime, w).g;
            glass.b = bgColor(suv - off * 1.12, uTime, w).b;
            // real glass reads darker at grazing angles on a light bg
            glass *= 1.0 - fres * 0.55;
            glass += vec3(spec) * 1.6 + rimCol * fres * 0.18;
            // soap-film iridescence so the form reads on pure white
            glass += hsv2rgb(vec3(fres * 1.8 + uTime * 0.06 + vWorldPos.y * 0.12, 0.5, 1.0)) * fres * 0.34;
            glass *= 1.0 - pow(fres, 2.0) * 0.22;
            base = mix(base, glass, uGlass);
          }

          // ---- wireframe dissolve ----
          if (uWire > 0.001) {
            float edge = edgeFactor(vBary);
            float on = step(vSeed, uWire * 1.15);
            vec3 wireCol = vec3(0.92) + vec3(0.2, 0.5, 0.6) * fres;
            vec3 hollow = wireCol * edge * on;
            float wireAlpha = max(edge * on, 0.06);
            base = mix(base, hollow, uWire);
            alpha = mix(alpha, wireAlpha, uWire);
          }

          gl_FragColor = vec4(base, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(bakeGeometry(), mat);
    this.mesh.frustumCulled = false;
    this.inner.add(this.mesh);

    // invisible raycast proxy
    this.proxy = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.inner.add(this.proxy);

    // soft blob shadow
    this.shadowUniforms = { uOpacity: { value: 0.3 } };
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.6),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: this.shadowUniforms,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uOpacity; varying vec2 vUv;
          void main(){
            float d = length((vUv - 0.5) * vec2(2.0, 2.4));
            gl_FragColor = vec4(vec3(0.0), smoothstep(1.0, 0.1, d) * uOpacity);
          }`,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

    // jump state
    this.jumpT = 10;
    this.spin = 0;
  }

  jump() {
    if (this.jumpT < 1.2) return false;
    this.jumpT = 0;
    return true;
  }

  update(ctx) {
    const { t, dt, weights, pose } = ctx;
    const u = this.uniforms;
    u.uTime.value = t;
    for (let i = 0; i < 6; i++) u.uSec.value[i] = weights[i];
    u.uGlass.value = weights[1];
    u.uWire.value = weights[2];
    u.uCursorPow.value = weights[2];
    u.uCursor.value.copy(ctx.cursorWorld);
    u.uResolution.value.set(ctx.width * ctx.dpr, ctx.height * ctx.dpr);
    u.uReveal.value = ctx.reveal;

    // pose from scroll choreography
    this.group.position.set(pose.x, pose.y, pose.z);
    this.group.scale.setScalar(pose.s);
    this.group.rotation.y = pose.ry;
    this.group.rotation.x = pose.rx;

    // jump physics: half-sine arc + a front flip
    this.jumpT += dt;
    const jp = Math.min(this.jumpT / 1.1, 1);
    const arc = Math.sin(jp * Math.PI);
    const flip = -(1 - Math.pow(1 - jp, 3)) * Math.PI * 2;
    const squash =
      jp < 1
        ? Math.cos(jp * Math.PI * 2) * -0.16 * (1 - jp)
        : 0;

    // idle bob + run-cycle bounce in the outro
    const run = weights[5];
    const bob = Math.sin(t * 1.8) * 0.05 * (1 - run) + Math.abs(Math.sin(t * 7.0)) * 0.13 * run;

    this.inner.position.y = bob + arc * 0.85;
    this.inner.rotation.z = flip * (jp < 1 ? 1 : 0) + Math.sin(t * 7.0) * 0.04 * run;
    u.uSquash.value = squash + Math.sin(t * 7.0) * 0.05 * run;

    // shadow follows
    const groundY = pose.shadowY;
    this.shadow.position.set(pose.x, groundY, pose.z);
    const h = this.inner.position.y - (groundY - pose.y);
    const sh = Math.max(0.25, 1.1 - h * 0.4) * pose.s;
    this.shadow.scale.setScalar(sh);
    this.shadowUniforms.uOpacity.value =
      0.34 * Math.max(weights[0], weights[3] * 0.7, weights[5]) * Math.max(0, 1 - h * 0.35) * ctx.reveal;
  }
}
