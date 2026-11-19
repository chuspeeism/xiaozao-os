import * as THREE from "three";
import { commonGLSL } from "./glsl.js";

/* Fullscreen procedural background, rendered first with depth off. */
export class Background {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uSec: { value: [1, 0, 0, 0, 0, 0] },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSec[6];
        varying vec2 vUv;
        ${commonGLSL}
        void main() {
          float w[6];
          for (int i = 0; i < 6; i++) w[i] = uSec[i];
          vec3 c = bgColor(vUv, uTime, w);
          // unifying film grain
          c += (hash21(vUv * 941.3 + fract(uTime) * 73.1) - 0.5) * 0.055;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });

    this.scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  update(t, weights) {
    this.uniforms.uTime.value = t;
    const sec = this.uniforms.uSec.value;
    for (let i = 0; i < 6; i++) sec[i] = weights[i];
  }
}
