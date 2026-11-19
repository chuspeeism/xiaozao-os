import * as THREE from "three";
import { commonGLSL } from "./glsl.js";

/* ============================================================
 * Section 2 — floating glass panes (refract the procedural bg)
 * ============================================================ */
export class GlassPanes {
  constructor(scene) {
    this.uniforms = {
      uTime: { value: 0 },
      uSec: { value: [0, 0, 0, 0, 0, 0] },
      uOpacity: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSec[6];
        uniform float uOpacity;
        uniform vec2 uResolution;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec2 vUv;
        ${commonGLSL}
        void main() {
          float w[6];
          for (int i = 0; i < 6; i++) w[i] = uSec[i];
          vec3 n = normalize(vNormal);
          float fres = pow(1.0 - abs(dot(n, normalize(vViewDir))), 2.5);
          vec2 suv = gl_FragCoord.xy / uResolution;
          vec2 off = n.xy * 0.10;
          vec3 c = bgColor(suv - off, uTime, w) * 0.96;
          c *= 1.0 - fres * 0.30;
          // edge frame, dark so panes read on the white section
          vec2 e = min(vUv, 1.0 - vUv);
          float edge = 1.0 - smoothstep(0.0, 0.015, min(e.x, e.y));
          c = mix(c, vec3(0.12), edge * 0.85);
          gl_FragColor = vec4(c, (0.5 + fres * 0.4 + edge * 0.5) * uOpacity);
        }
      `,
    });

    this.group = new THREE.Group();
    this.panes = [];
    const defs = [
      { p: [1.7, 0.45, -0.6], r: [0.1, -0.45, 0.08], s: [1.3, 1.8] },
      { p: [-1.9, -0.25, -1.1], r: [-0.06, 0.5, -0.1], s: [1.1, 1.5] },
      { p: [0.6, -0.9, 0.6], r: [0.3, 0.2, 0.2], s: [0.9, 1.2] },
      { p: [-0.8, 1.1, -1.8], r: [-0.2, 0.3, -0.15], s: [1.4, 1.0] },
    ];
    for (const d of defs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.s[0], d.s[1]), mat);
      m.position.set(...d.p);
      m.rotation.set(...d.r);
      m.userData.seed = Math.random() * 10;
      this.group.add(m);
      this.panes.push(m);
    }
    scene.add(this.group);
  }

  update(t, weights, w, h, dpr) {
    const wt = weights[1];
    this.group.visible = wt > 0.005;
    this.uniforms.uTime.value = t;
    this.uniforms.uOpacity.value = wt;
    this.uniforms.uResolution.value.set(w * dpr, h * dpr);
    for (let i = 0; i < 6; i++) this.uniforms.uSec.value[i] = weights[i];
    for (const p of this.panes) {
      p.position.y += Math.sin(t * 0.7 + p.userData.seed) * 0.0012;
      p.rotation.y += 0.0008;
    }
  }
}

/* ============================================================
 * Section 3 — dark tech: drifting particles + HUD display frames
 * ============================================================ */
export class TechField {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // --- particles ---
    const N = 420;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
      seed[i] = Math.random();
    }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pgeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));

    this.pUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const pmat = new THREE.ShaderMaterial({
      uniforms: this.pUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        varying float vSeed;
        void main() {
          vSeed = aSeed;
          vec3 p = position;
          p.y += sin(uTime * 0.4 + aSeed * 20.0) * 0.3;
          p.x += sin(uTime * 0.25 + aSeed * 13.0) * 0.25;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + aSeed * 5.0) * (3.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying float vSeed;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d);
          float tw = 0.55 + 0.45 * sin(uTime * (1.0 + vSeed * 3.0) + vSeed * 40.0);
          vec3 c = mix(vec3(1.0), vec3(0.45, 0.85, 1.0), vSeed);
          gl_FragColor = vec4(c, a * tw * uOpacity * 0.8);
        }
      `,
    });
    const points = new THREE.Points(pgeo, pmat);
    points.frustumCulled = false;
    this.group.add(points);

    // --- display frames ---
    this.dUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const dmat = new THREE.ShaderMaterial({
      uniforms: this.dUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        float rectBorder(vec2 uv, float th) {
          vec2 e = min(uv, 1.0 - uv);
          return 1.0 - smoothstep(th, th + 0.008, min(e.x, e.y));
        }
        void main() {
          float a = rectBorder(vUv, 0.012) * 0.9;
          // sweeping scanline
          float scan = exp(-abs(fract(vUv.y + uTime * 0.18) - 0.5) * 28.0) * 0.45;
          // dotted data rows
          float rows = step(0.92, sin(vUv.y * 60.0) * 0.5 + 0.5)
                     * step(0.4, sin(vUv.x * 90.0 + uTime * 6.0) * 0.5 + 0.5) * 0.5;
          // corner ticks
          vec2 c = min(vUv, 1.0 - vUv);
          float tick = (1.0 - smoothstep(0.05, 0.06, c.x)) * (1.0 - smoothstep(0.05, 0.06, c.y));
          a += scan + rows * (1.0 - rectBorder(vUv, 0.05)) + tick * 0.8;
          gl_FragColor = vec4(vec3(0.55, 0.9, 1.0), a * uOpacity * 0.85);
        }
      `,
    });
    this.displays = [];
    const ddefs = [
      { p: [1.85, 0.55, -0.4], r: [0, -0.5, 0], s: [1.5, 0.95] },
      { p: [2.2, -0.6, -1.0], r: [0.1, -0.6, 0.05], s: [1.1, 0.7] },
      { p: [1.3, 1.4, -1.6], r: [-0.15, -0.35, 0], s: [0.9, 0.55] },
    ];
    for (const d of ddefs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.s[0], d.s[1]), dmat);
      m.position.set(...d.p);
      m.rotation.set(...d.r);
      m.userData.seed = Math.random() * 9;
      this.group.add(m);
      this.displays.push(m);
    }
  }

  update(t, weights) {
    const w = weights[2];
    this.group.visible = w > 0.005;
    this.pUniforms.uTime.value = t;
    this.pUniforms.uOpacity.value = w;
    this.dUniforms.uTime.value = t;
    this.dUniforms.uOpacity.value = w;
    for (const d of this.displays) {
      d.position.y += Math.sin(t * 0.8 + d.userData.seed) * 0.001;
    }
  }
}

/* ============================================================
 * Section 5 — rotating text ring + grid floor
 * ============================================================ */
export class VisionRing {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const makeRingTex = (text, px) => {
      const cv = document.createElement("canvas");
      cv.width = 2048;
      cv.height = 128;
      const g = cv.getContext("2d");
      g.clearRect(0, 0, 2048, 128);
      g.font = `900 ${px}px Archivo, sans-serif`;
      g.fillStyle = "#fff";
      g.textBaseline = "middle";
      let x = 0;
      while (x < 2048 + 600) {
        g.fillText(text, x, 70);
        x += g.measureText(text).width;
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const mkRing = (radius, height, tex, op) => {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: op,
      });
      mat.map.repeat.x = 2;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, 80, 1, true),
        mat
      );
      return m;
    };

    this.ring1 = mkRing(1.85, 0.4, makeRingTex("VISION — NEXT — DREAM — ", 86), 0.95);
    this.ring2 = mkRing(2.6, 0.26, makeRingTex("まだ見ぬ未来へ — KEEP GOING — ", 64), 0.4);
    this.ring2.position.y = 0.75;
    this.ring2.rotation.x = 0.06;
    this.ring1.rotation.x = -0.04;
    this.group.add(this.ring1, this.ring2);

    // grid floor
    this.gridUniforms = { uOpacity: { value: 0 }, uTime: { value: 0 } };
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: this.gridUniforms,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 g = abs(fract(vUv * 24.0 + vec2(0.0, uTime * 0.05)) - 0.5);
            float line = 1.0 - smoothstep(0.46, 0.5, max(g.x, g.y));
            float fade = smoothstep(0.62, 0.18, length(vUv - 0.5));
            gl_FragColor = vec4(vec3(1.0), line * fade * 0.16 * uOpacity);
          }
        `,
      })
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -1.25;
    this.group.add(grid);
  }

  update(t, weights) {
    const w = weights[4];
    this.group.visible = w > 0.005;
    this.ring1.material.map.offset.x = t * 0.022;
    this.ring2.material.map.offset.x = -t * 0.014;
    this.ring1.material.opacity = 0.95 * w;
    this.ring2.material.opacity = 0.4 * w;
    this.gridUniforms.uOpacity.value = w;
    this.gridUniforms.uTime.value = t;
  }
}

/* ============================================================
 * Section 6 — road to the dawn + wind streaks + stars
 * ============================================================ */
export class OutroField {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // road
    this.roadUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 60),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: this.roadUniforms,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uOpacity;
          varying vec2 vUv;
          float hash21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
          void main() {
            vec3 c = vec3(0.05) + hash21(floor(vUv * vec2(140.0, 700.0))) * 0.02;
            // scrolling center dashes
            float dash = step(abs(vUv.x - 0.5), 0.006)
                       * step(fract(vUv.y * 36.0 + uTime * 1.4), 0.55);
            c += vec3(1.0, 0.85, 0.6) * dash * 0.75;
            // side lines
            float side = step(abs(abs(vUv.x - 0.5) - 0.16), 0.0035);
            c += vec3(0.55) * side;
            // dawn sheen creeping up the asphalt
            c += vec3(0.85, 0.28, 0.10) * smoothstep(0.25, 0.75, vUv.y) * 0.30;
            float fadeFar = smoothstep(1.0, 0.55, vUv.y);
            float fadeNear = smoothstep(0.0, 0.12, vUv.y);
            float a = fadeFar * fadeNear * uOpacity;
            gl_FragColor = vec4(c, a);
          }
        `,
      })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -1.18, -22);
    this.group.add(road);

    // wind streaks
    const N = 130;
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute("position", plane.getAttribute("position"));
    geo.setAttribute("uv", plane.getAttribute("uv"));
    const iPos = new Float32Array(N * 3);
    const iSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      iPos[i * 3 + 0] = (Math.random() - 0.5) * 9;
      iPos[i * 3 + 1] = -0.8 + Math.random() * 3.4;
      iPos[i * 3 + 2] = -14 + Math.random() * 18;
      iSeed[i] = Math.random();
    }
    geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(iSeed, 1));

    this.windUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const wmat = new THREE.ShaderMaterial({
      uniforms: this.windUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 iPos;
        attribute float iSeed;
        uniform float uTime;
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          vUv = uv;
          vSeed = iSeed;
          vec3 p = iPos;
          float speed = 7.0 + iSeed * 9.0;
          p.z = mod(iPos.z + uTime * speed, 19.0) - 14.0;
          float len = 1.2 + iSeed * 2.4;
          // plane lies along z (motion axis)
          vec3 world = p + vec3(position.x * 0.014, 0.0, position.y * len);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          float a = sin(vUv.y * 3.14159);
          a *= smoothstep(0.5, 0.45, abs(vUv.x - 0.5));
          vec3 c = mix(vec3(1.0), vec3(1.0, 0.7, 0.45), vSeed * 0.7);
          gl_FragColor = vec4(c, a * uOpacity * 0.30);
        }
      `,
    });
    const wind = new THREE.Mesh(geo, wmat);
    wind.frustumCulled = false;
    this.group.add(wind);

    // stars above the dawn
    const SN = 240;
    const spos = new Float32Array(SN * 3);
    const sseed = new Float32Array(SN);
    for (let i = 0; i < SN; i++) {
      spos[i * 3 + 0] = (Math.random() - 0.5) * 44;
      spos[i * 3 + 1] = 1.2 + Math.random() * 12;
      spos[i * 3 + 2] = -26;
      sseed[i] = Math.random();
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
    sgeo.setAttribute("aSeed", new THREE.BufferAttribute(sseed, 1));
    this.starUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const smat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying float vSeed;
        varying float vY;
        void main() {
          vSeed = aSeed;
          vY = position.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.5 + aSeed * 2.5) * (30.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying float vSeed;
        varying float vY;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d);
          float tw = 0.5 + 0.5 * sin(uTime * (0.8 + vSeed * 2.5) + vSeed * 40.0);
          // fade out near the dawn glow
          float horizon = smoothstep(1.2, 4.0, vY);
          gl_FragColor = vec4(vec3(0.9, 0.95, 1.0), a * tw * horizon * uOpacity * 0.8);
        }
      `,
    });
    const stars = new THREE.Points(sgeo, smat);
    stars.frustumCulled = false;
    this.group.add(stars);
  }

  update(t, weights) {
    const w = weights[5];
    this.group.visible = w > 0.005;
    this.roadUniforms.uTime.value = t;
    this.roadUniforms.uOpacity.value = w;
    this.windUniforms.uTime.value = t;
    this.windUniforms.uOpacity.value = w;
    this.starUniforms.uTime.value = t;
    this.starUniforms.uOpacity.value = w;
  }
}
