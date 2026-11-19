/*
 * Shared GLSL chunks.
 * bgColor() is the single source of truth for the per-section background
 * palette — the fullscreen bg quad samples it directly, and the glass
 * material "refracts" it by re-evaluating the same function with a
 * normal-offset screen uv (the background is procedural, so this fake
 * refraction is pixel-accurate and costs nothing).
 */
export const commonGLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 bgColor(vec2 uv, float t, float w[6]) {
    // 01 — drifting rainbow gradient
    vec3 s1 = hsv2rgb(vec3(
      uv.y * 0.22 - uv.x * 0.06 + t * 0.045 + hash21(uv * 521.7) * 0.025,
      0.42, 1.0
    ));
    // 02 — white / 03 — black / 04 — paper white
    vec3 s2 = vec3(1.0);
    vec3 s3 = vec3(0.012);
    vec3 s4 = vec3(0.975);
    // 05 — deep gray vertical ramp
    vec3 s5 = vec3(mix(0.035, 0.17, smoothstep(0.0, 1.0, uv.y)));
    // 06 — night sky with a chromatic dawn glow at the top
    vec3 s6 = vec3(0.012, 0.012, 0.030);
    float g = uv.y + sin(uv.x * 3.1 + t * 0.2) * 0.012;
    s6 += vec3(1.00, 0.38, 0.14) * exp(-pow((0.78 - g) * 7.5, 2.0)) * 0.85;
    s6 += vec3(0.95, 0.55, 0.65) * exp(-pow((0.86 - g) * 9.0, 2.0)) * 0.45;
    s6 += vec3(1.00, 0.85, 0.60) * smoothstep(0.88, 1.05, g);
    s6 += vec3(
      sin(g * 16.0 + t * 0.6) * 0.030,
      sin(g * 16.0 + t * 0.6 + 0.5) * 0.030,
      sin(g * 16.0 + t * 0.6 + 1.0) * 0.030
    ) * smoothstep(0.3, 0.9, g);

    vec3 c = vec3(1.0);
    c = mix(c, s1, w[0]);
    c = mix(c, s2, w[1]);
    c = mix(c, s3, w[2]);
    c = mix(c, s4, w[3]);
    c = mix(c, s5, w[4]);
    c = mix(c, s6, w[5]);
    return c;
  }
`;
