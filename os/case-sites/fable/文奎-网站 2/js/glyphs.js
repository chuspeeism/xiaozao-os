import * as THREE from "three";

/*
 * GlyphField — one instanced plane, the fragment shader draws a flat
 * pictogram per instance (cross / dot / line / slash / little person).
 * Used twice: the orbiting graphic confetti of section 1, and the
 * bobbing crowd of section 4.
 */
export class GlyphField {
  constructor(scene, opts) {
    const {
      count,
      types,          // array of allowed glyph type ids
      layout,         // "orbit" | "crowd"
      color = new THREE.Color(0x111111),
      baseScale = 0.22,
    } = opts;

    this.layout = layout;

    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute("position", plane.getAttribute("position"));
    geo.setAttribute("uv", plane.getAttribute("uv"));

    const iPos = new Float32Array(count * 3);
    const iScale = new Float32Array(count);
    const iType = new Float32Array(count);
    const iSeed = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      if (layout === "orbit") {
        // shell around the creature
        const r = 1.9 + Math.random() * 1.6;
        const th = Math.random() * Math.PI * 2;
        const ph = (Math.random() - 0.5) * 2.2;
        iPos[i * 3 + 0] = Math.cos(th) * r;
        iPos[i * 3 + 1] = Math.sin(ph) * 1.5;
        iPos[i * 3 + 2] = Math.sin(th) * r * 0.6;
        iScale[i] = baseScale * (0.5 + Math.random());
      } else {
        // crowd rows on the ground
        const row = Math.floor(i / 24);
        const col = i % 24;
        iPos[i * 3 + 0] = (col - 11.5) * 0.42 + (Math.random() - 0.5) * 0.16;
        iPos[i * 3 + 1] = -1.05;
        iPos[i * 3 + 2] = -row * 0.85 - 0.3 + (Math.random() - 0.5) * 0.3;
        iScale[i] = baseScale * (0.85 + Math.random() * 0.3);
      }
      iType[i] = types[Math.floor(Math.random() * types.length)];
      iSeed[i] = Math.random();
    }

    geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute("iScale", new THREE.InstancedBufferAttribute(iScale, 1));
    geo.setAttribute("iType", new THREE.InstancedBufferAttribute(iType, 1));
    geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(iSeed, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: color },
      uSpin: { value: layout === "orbit" ? 1 : 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 iPos;
        attribute float iScale;
        attribute float iType;
        attribute float iSeed;
        uniform float uTime;
        uniform float uSpin;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vType;
        varying float vSeed;
        varying float vAlpha;

        void main() {
          vUv = uv;
          vType = iType;
          vSeed = iSeed;
          // staggered appear
          vAlpha = clamp(uOpacity * 1.6 - iSeed * 0.6, 0.0, 1.0);

          vec3 base = iPos;
          base.y += sin(uTime * (1.2 + iSeed) + iSeed * 17.0) * 0.08 * uSpin;
          base.y += sin(uTime * 2.2 + iSeed * 31.0) * 0.05 * (1.0 - uSpin);

          vec4 mv = modelViewMatrix * vec4(base, 1.0);
          vec2 corner = position.xy;
          // long bars for the "line" glyph
          if (abs(iType - 2.0) < 0.1) corner.x *= 3.4;
          float a = (uTime * 0.35 + iSeed * 6.283) * uSpin;
          float c = cos(a), s = sin(a);
          corner = mat2(c, -s, s, c) * corner;
          float pop = 1.0 - pow(1.0 - vAlpha, 3.0);
          mv.xy += corner * iScale * pop;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vType;
        varying float vSeed;
        varying float vAlpha;

        float bar(vec2 p, vec2 half_) {
          vec2 d = abs(p) - half_;
          return 1.0 - smoothstep(-0.01, 0.015, max(d.x, d.y));
        }

        void main() {
          vec2 p = vUv - 0.5;
          int t = int(vType + 0.5);
          float m = 0.0;

          if (t == 0) {            // cross  +
            m = max(bar(p, vec2(0.065, 0.40)), bar(p, vec2(0.40, 0.065)));
          } else if (t == 1) {     // dot / ring
            float d = length(p);
            m = vSeed > 0.5
              ? 1.0 - smoothstep(0.30, 0.34, d)
              : smoothstep(0.22, 0.26, d) * (1.0 - smoothstep(0.32, 0.36, d));
          } else if (t == 2) {     // line
            m = bar(p, vec2(0.48, 0.05));
          } else if (t == 3) {     // slash
            vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
            m = bar(q, vec2(0.06, 0.42));
          } else {                 // little person
            float head = 1.0 - smoothstep(0.10, 0.125, length(p - vec2(0.0, 0.26)));
            vec2 b = p - vec2(0.0, -0.05);
            b.x /= 0.62;
            float body = 1.0 - smoothstep(0.22, 0.245, length(b));
            m = max(head, body);
          }

          float a = m * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  update(t, weight) {
    this.uniforms.uTime.value = t;
    this.uniforms.uOpacity.value = weight;
    this.group.visible = weight > 0.005;
    if (this.layout === "orbit") this.group.rotation.y = t * 0.05;
  }
}
