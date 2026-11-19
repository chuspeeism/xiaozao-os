import * as THREE from 'three';

/* ============================================================
 * ATMOS v3 —— Shadertoy 风格全屏 raymarching 天气模拟
 *
 * 「时间 × 天气」二维大气系统：
 *   - 时间轴驱动太阳/月亮弧线，天空颜色由太阳高度角实时推导
 *     （白昼蓝天 → 金色时段 → 暮色 → 星空 + 月光）
 *   - 天气预设只做调制（去饱和/压暗/染色、云雾雨雪参数）
 *   - 八种天气：晴 / 阴 / 雷雨 / 沙尘暴 / 雾霾 / 雪 / 龙卷风 / 彩虹
 * 渲染：侵蚀 fbm 山体行进、体积云、体积尘雾、体积龙卷风漏斗、
 *       角度空间彩虹（主虹 42°/副虹 51°）、亮度感知雨幕、
 *       Heartfelt 式镜头水珠滑落、星空、程序化闪电。
 * ============================================================ */

/* ---------------- 调试：shader 错误显示到页面 ---------------- */
const errBox = document.createElement('pre');
errBox.style.cssText = 'position:fixed;left:8px;top:80px;max-width:90vw;max-height:70vh;overflow:auto;background:rgba(120,0,0,.88);color:#fff;font-size:10px;z-index:99;padding:8px;white-space:pre-wrap;display:none';
document.body.appendChild(errBox);
const origErr = console.error.bind(console);
console.error = (...a) => {
  errBox.style.display = 'block';
  errBox.textContent = (errBox.textContent + a.join(' ') + '\n').slice(-6000);
  origErr(...a);
};
window.addEventListener('error', (e) => {
  errBox.style.display = 'block';
  errBox.textContent += e.message + '\n';
});

/* ---------------- Fragment Shader ---------------- */

const FRAG = /* glsl */`
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uCloudTime;
uniform vec3  uCamPos;
uniform float uYaw, uPitch;

uniform vec3  uSunDir;
uniform vec3  uSunCol;
uniform float uSunInt;
uniform float uDiscA, uDiscInt;
uniform vec3  uZenith, uHorizon;
uniform float uMie;
uniform vec3  uMieCol;
uniform float uAmb;
uniform float uAerial;
uniform vec3  uAerialCol;
uniform float uNight;

uniform float uCloudCover, uCloudAmb, uCloudDens, uCloudBase;
uniform vec3  uCloudDark;

uniform float uFogDens, uFogH, uFogNoise;
uniform vec3  uFogCol;

uniform float uRain, uWet, uWind, uGrime, uDustStreak;
uniform vec3  uGrimeCol;
uniform float uSnowAmt, uSnowfall, uRainbow, uTornado;
uniform float uSat, uExposure;
uniform float uFlash, uBoltAz, uBoltSeed, uBoltOn;
uniform float uZoom;

const mat2 M2 = mat2(0.8, -0.6, 0.6, 0.8);
const float WATER_Y = 0.0;
const vec2 TPOS = vec2(-60.0, -190.0);   // 龙卷风地面落点

/* ---------- 噪声 ---------- */

float hash1(float n){ return fract(sin(n)*43758.5453123); }
float hash1v(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }

float noise2(in vec2 x){
  vec2 p = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  float a = hash1v(p);
  float b = hash1v(p+vec2(1.0,0.0));
  float c = hash1v(p+vec2(0.0,1.0));
  float d = hash1v(p+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float noise3(in vec3 x){
  vec3 p = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n = p.x + p.y*157.0 + 113.0*p.z;
  return mix(mix(mix(hash1(n+  0.0),hash1(n+  1.0),f.x),
                 mix(hash1(n+157.0),hash1(n+158.0),f.x),f.y),
             mix(mix(hash1(n+113.0),hash1(n+114.0),f.x),
                 mix(hash1(n+270.0),hash1(n+271.0),f.x),f.y),f.z);
}
float fbm2(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ s += a*noise2(p); p = M2*p*2.02; a *= 0.5; }
  return s;
}
float fbm3(vec3 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ s += a*noise3(p); p = p*2.05; a *= 0.5; }
  return s;
}

/* ---------- 地形（iq "Elevated" 式带导数侵蚀 fbm） ---------- */

vec3 noised(in vec2 x){
  vec2 p = floor(x), f = fract(x);
  vec2 u = f*f*(3.0-2.0*f);
  vec2 du = 6.0*f*(1.0-f);
  float a = hash1v(p);
  float b = hash1v(p+vec2(1.0,0.0));
  float c = hash1v(p+vec2(0.0,1.0));
  float d = hash1v(p+vec2(1.0,1.0));
  float k1 = b-a, k2 = c-a, k4 = a-b-c+d;
  return vec3(a + k1*u.x + k2*u.y + k4*u.x*u.y,
              du*(vec2(k1,k2) + k4*u.yx));
}

float erodedFbm(in vec2 p, const int oct){
  float a = 0.0, b = 1.0;
  vec2 d = vec2(0.0);
  for(int i=0;i<12;i++){
    if(i>=oct) break;
    vec3 n = noised(p);
    d += n.yz;
    a += b*n.x/(1.0 + dot(d,d));
    b *= 0.5;
    p = M2*p*2.0;
  }
  return a;
}

// 森林分布：谷底缓坡的噪声斑块（海拔 1~30m）
float treeZone(vec2 p, float h){
  return smoothstep(0.50, 0.60, noise2(p*0.018+7.0))
       * smoothstep(30.0, 22.0, h) * smoothstep(0.8, 3.0, h);
}

float terrainShape(vec2 p, const int oct){
  float r = length(p);
  float m = erodedFbm(p*0.006, oct);
  float mAmp = 140.0*smoothstep(90.0, 580.0, r) + 14.0;
  float h = m*mAmp - 6.0;
  h = mix(7.0 + m*5.0, h, smoothstep(18.0, 60.0, r));
  float lake = smoothstep(90.0, 38.0, length(p - vec2(0.0,-110.0)));
  h = mix(h, -7.0, 0.95*lake);
  // 树冠层：第二高度场叠加（iq "Rainforest" 做法），剪影/阴影/法线自动成立
  float tz = treeZone(p, h);
  if(tz > 0.01){
    float cr = noise2(p*0.35);
    float cr2 = noise2(p*0.9+13.0);
    h += tz*(2.0 + 5.0*cr*cr + 1.5*cr2*cr2);
  }
  return h;
}
float terrainBase(vec2 p){ return terrainShape(p, 6); }
float terrainHi(vec2 p){ return terrainShape(p, 9); }

float marchTerrain(vec3 ro, vec3 rd, float tmax){
  float t = 0.3, tp = 0.0, dp = 0.0;
  for(int i=0;i<150;i++){
    vec3 p = ro + rd*t;
    if(p.y > 280.0 && rd.y > 0.0) return -1.0;
    float d = p.y - terrainBase(p.xz);
    if(d < 0.002*t){
      return (dp > d) ? tp + (t-tp)*dp/(dp-d) : t;
    }
    tp = t; dp = d;
    t += d*0.45;
    if(t > tmax) return -1.0;
  }
  return -1.0;
}

float softShadow(vec3 ro, vec3 rd){
  if(rd.y < 0.02) return 0.4;
  float res = 1.0, t = 1.5;
  for(int i=0;i<22;i++){
    vec3 p = ro + rd*t;
    if(p.y > 260.0) break;
    float h = p.y - terrainBase(p.xz);
    res = min(res, 7.0*h/t);
    if(res < 0.01) break;
    t += clamp(h, 0.9, 16.0);
  }
  return clamp(res, 0.0, 1.0);
}

vec3 terrainNormal(vec2 p, float t){
  float e = 0.03 + 0.0016*t;
  return normalize(vec3(
    terrainHi(p-vec2(e,0.0)) - terrainHi(p+vec2(e,0.0)),
    2.0*e,
    terrainHi(p-vec2(0.0,e)) - terrainHi(p+vec2(0.0,e))
  ));
}

/* ---------- 大气 / 天空 / 星空 ---------- */

vec3 skyColor(vec3 rd, bool withSun){
  float y = clamp(rd.y, -0.25, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(y+0.045, 0.0, 1.0), 0.55));
  sky = mix(sky, uHorizon*0.92, smoothstep(0.0, -0.25, y));
  float sd = clamp(dot(rd, uSunDir), 0.0, 1.0);
  sky += uMieCol * uMie * (0.20*pow(sd,3.0) + 0.50*pow(sd,32.0));
  // 星空
  if(uNight > 0.005){
    vec3 sq = rd*280.0;
    vec3 sid = floor(sq);
    vec3 sf = fract(sq)-0.5;
    float sh = hash1(sid.x + sid.y*157.0 + sid.z*113.0);
    float tw = 0.55+0.45*sin(uTime*2.5 + sh*50.0);
    sky += vec3(0.85,0.90,1.0) * smoothstep(0.35,0.05,length(sf)) * step(0.998, sh)
         * tw * uNight * 1.6 * smoothstep(0.0,0.2,rd.y);
  }
  if(withSun && uDiscInt > 0.001){
    float disc = smoothstep(cos(uDiscA*1.8), cos(uDiscA), sd);
    sky += uSunCol * uDiscInt * disc;
  }
  return sky;
}

/* ---------- 体积云 ---------- */

float cloudMap(vec3 p){
  float hgt = (p.y - uCloudBase)/420.0;
  if(hgt < 0.0 || hgt > 1.0) return 0.0;
  float prof = smoothstep(0.0,0.15,hgt)*smoothstep(1.0,0.5,hgt);
  vec3 q = p*0.0021 + vec3(uCloudTime*0.030, 0.0, uCloudTime*0.012);
  float f = fbm3(q) + 0.22*noise3(q*4.1);
  float d = (f - (1.12 - uCloudCover*0.95))*2.6;
  return clamp(d, 0.0, 1.0)*prof*uCloudDens;
}

vec4 marchClouds(vec3 ro, vec3 rd, float tscene){
  if(rd.y < 0.02) return vec4(0.0);
  float t0 = (uCloudBase - ro.y)/rd.y;
  float t1 = (uCloudBase + 420.0 - ro.y)/rd.y;
  if(t0 > 2800.0) return vec4(0.0);
  float tlim = (tscene > 0.0) ? tscene : 1e6;
  if(t0 > tlim) return vec4(0.0);
  vec4 sum = vec4(0.0);
  float dt = (t1 - t0)/44.0;
  float t = t0 + dt*hash1v(gl_FragCoord.xy);
  vec3 ambSky = mix(uHorizon, uZenith, 0.5);
  for(int i=0;i<44;i++){
    if(sum.a > 0.99 || t > tlim) break;
    vec3 p = ro + rd*t;
    float den = cloudMap(p);
    if(den > 0.012){
      float dif = clamp((den - cloudMap(p + uSunDir*32.0))*1.8, 0.0, 1.0);
      vec3 lin = ambSky*uCloudAmb*1.7
               + uSunCol*uSunInt*0.55*dif
               + vec3(0.80,0.85,1.0)*uFlash*2.5;
      vec3 alb = mix(vec3(1.00,0.99,0.97), uCloudDark, clamp(den*1.7, 0.0, 1.0));
      float a = 1.0 - exp(-den*dt*0.10);
      sum.rgb += alb*lin*a*(1.0-sum.a);
      sum.a   += a*(1.0-sum.a);
    }
    t += dt;
  }
  float fade = 1.0 - exp(-max(t0-300.0, 0.0)*0.0011);
  sum.rgb = mix(sum.rgb, skyColor(rd, false)*sum.a, fade);
  return sum;
}

/* ---------- 体积沙尘 / 雾霾 ---------- */

vec4 marchFog(vec3 ro, vec3 rd, float tend){
  if(uFogDens < 1e-5) return vec4(0.0,0.0,0.0,1.0);
  float dt = tend/14.0;
  float t = dt*hash1v(gl_FragCoord.yx + 3.7);
  vec3 acc = vec3(0.0); float trans = 1.0;
  float ph = pow(clamp(dot(rd, uSunDir), 0.0, 1.0), 6.0);
  vec3 lcol = uFogCol*(0.40 + 0.65*uAmb) + uMieCol*uMie*ph*0.55
            + vec3(0.8,0.85,1.0)*uFlash*0.8;
  for(int i=0;i<14;i++){
    vec3 p = ro + rd*t;
    float den = uFogDens * exp(-max(p.y, 0.0)/uFogH);
    if(uFogNoise > 0.01){
      float n = fbm3(p*vec3(0.022,0.05,0.022) + vec3(uTime*(0.4+uWind*1.8), 0.0, uTime*0.1));
      den *= mix(1.0, clamp(n*2.4-0.45, 0.0, 2.4), uFogNoise);
    }
    float a = 1.0 - exp(-den*dt);
    acc += lcol*a*trans;
    trans *= 1.0 - a;
    if(trans < 0.02) break;
    t += dt;
  }
  return vec4(acc, trans);
}

/* ---------- 龙卷风（体积漏斗步进） ---------- */

const float TSCALE = 3.0;                  // 龙卷风横向体量放大系数（大小 ×3）

float funnelDen(vec3 p){
  if(p.y < 0.0 || p.y > 220.0) return 0.0;
  float fy = clamp(p.y/200.0, 0.0, 1.0);
  vec2 ax = TPOS + vec2(20.0*TSCALE*sin(p.y*0.016 + uTime*0.6),
                        16.0*TSCALE*sin(p.y*0.021 - uTime*0.45 + 2.0));
  vec2 d2 = p.xz - ax;
  float rr = length(d2);
  float R = (7.0 + 46.0*pow(fy, 1.6)) * TSCALE;
  float th = atan(d2.y, d2.x);
  float sw = noise3(vec3(th*2.0 + p.y*0.04, p.y*0.06 - uTime*2.6, uTime*0.5));
  float shell = exp(-pow(max(rr - R*0.45, 0.0)/(R*0.55), 2.0));
  float den = shell*(0.45+0.55*sw)*(0.7+0.6*fy);
  den += exp(-pow(rr/((30.0+14.0*sw)*TSCALE), 2.0))*smoothstep(26.0,0.0,p.y)*0.9;  // 地面碎屑云
  return den;
}

vec4 marchTornado(vec3 ro, vec3 rd, float tscene){
  if(uTornado < 0.01) return vec4(0.0,0.0,0.0,1.0);
  vec2 oc = ro.xz - TPOS;
  float A = dot(rd.xz, rd.xz);
  if(A < 1e-5) return vec4(0.0,0.0,0.0,1.0);
  float B = 2.0*dot(oc, rd.xz);
  float C = dot(oc,oc) - 17000.0*TSCALE*TSCALE;   // 包围圆柱半径同步 ×3（半径² ×9）
  float disc = B*B - 4.0*A*C;
  if(disc < 0.0) return vec4(0.0,0.0,0.0,1.0);
  float sq = sqrt(disc);
  float s0 = max((-B - sq)/(2.0*A), 0.0);
  float s1 = min((-B + sq)/(2.0*A), (tscene > 0.0) ? tscene : 1e6);
  if(s1 <= s0) return vec4(0.0,0.0,0.0,1.0);
  float dt = (s1-s0)/26.0;
  float t = s0 + dt*hash1v(gl_FragCoord.xy + 7.7);
  vec3 acc = vec3(0.0); float trans = 1.0;
  vec3 light = mix(uHorizon,uZenith,0.5)*uAmb*2.2 + uSunCol*uSunInt*0.18
             + vec3(0.8,0.85,1.0)*uFlash*1.5;
  for(int i=0;i<26;i++){
    vec3 p = ro + rd*t;
    float den = funnelDen(p)*uTornado;
    if(den > 0.002){
      float fy = clamp(p.y/200.0, 0.0, 1.0);
      vec3 alb = mix(vec3(0.16,0.14,0.12), vec3(0.36,0.34,0.32), fy);
      float a = 1.0 - exp(-den*dt*0.30);
      acc += alb*light*a*trans;
      trans *= 1.0 - a;
      if(trans < 0.03) break;
    }
    t += dt;
  }
  return vec4(acc, trans);
}

/* ---------- 地表着色 ---------- */

vec3 shadeTerrain(vec3 p, vec3 rd){
  float tdist = length(p - uCamPos);
  vec3 n = terrainNormal(p.xz, tdist);
  float spot  = fbm2(p.xz*0.18);
  float spot2 = noise2(p.xz*1.7);
  float slope = 1.0 - n.y;
  float strata = 0.78 + 0.45*noise2(vec2(p.y*0.35, (p.x+p.z)*0.02));
  vec3 rock = mix(vec3(0.155,0.145,0.14), vec3(0.27,0.25,0.23), fbm2(p.xz*0.07+4.0))*strata;
  vec3 grass = mix(vec3(0.045,0.072,0.026), vec3(0.090,0.100,0.040), spot);
  vec3 scree = mix(vec3(0.17,0.15,0.12),   vec3(0.23,0.20,0.16), spot2);
  vec3 alb = grass;
  alb = mix(alb, scree, clamp(smoothstep(0.10,0.30,slope) + 0.3*smoothstep(0.55,0.75,spot2), 0.0, 1.0));
  alb = mix(alb, rock, smoothstep(0.28,0.55,slope));
  alb = mix(alb, rock, smoothstep(28.0,60.0,p.y));
  // 树冠着色：与高度场里的树冠层对应
  float tz = treeZone(p.xz, p.y - 4.0);
  if(tz > 0.01){
    float cr = noise2(p.xz*0.35);
    float treeM = smoothstep(0.12, 0.40, tz*(0.35+0.65*cr));
    vec3 treeCol = mix(vec3(0.024,0.052,0.016), vec3(0.085,0.115,0.035), noise2(p.xz*1.3));
    treeCol *= 0.75 + 0.5*noise2(p.xz*3.1);   // 冠层明暗起伏
    alb = mix(alb, treeCol, treeM);
  }
  // 雪：海拔雪线 + 雪天全局覆盖
  float snowLine = 62.0 + 26.0*noise2(p.xz*0.015) - p.y;
  float snow = smoothstep(8.0,-14.0,snowLine)*smoothstep(0.45,0.12,slope)*(1.0-uGrime);
  snow = max(snow, uSnowAmt*smoothstep(0.55,0.15,slope)*smoothstep(-1.0,1.5,p.y));
  alb = mix(alb, vec3(0.75,0.79,0.85), snow);
  alb = mix(vec3(0.20,0.16,0.10), alb, smoothstep(0.0,1.6,p.y-WATER_Y));
  alb = mix(alb, uGrimeCol*(0.75+0.4*spot), uGrime*0.85);
  alb *= 1.0 - 0.5*uWet;

  float sh  = softShadow(p+vec3(0.0,0.06,0.0), uSunDir);
  float dif = clamp(dot(n, uSunDir), 0.0, 1.0);
  float skyA = clamp(0.5+0.5*n.y, 0.0, 1.0);
  float bnc = clamp(dot(n, normalize(vec3(-uSunDir.x,0.0,-uSunDir.z))), 0.0, 1.0);
  vec3 ambSky = mix(uHorizon, uZenith, 0.5);
  vec3 lin = uSunCol*uSunInt*1.5*dif*sh
           + ambSky*uAmb*1.25*skyA
           + uSunCol*uSunInt*0.10*bnc
           + vec3(0.8,0.85,1.0)*uFlash*1.3;
  vec3 col = alb*lin;

  vec3 hv = normalize(uSunDir - rd);
  float fre = pow(clamp(1.0+dot(rd,n), 0.0, 1.0), 5.0);
  float spec = pow(clamp(dot(n,hv), 0.0, 1.0), mix(12.0, 90.0, uWet));
  // 雨点打在湿地上的高光闪烁
  spec *= 1.0 + uRain*0.8*(noise2(p.xz*4.0 + vec2(uTime*6.0, 0.0))-0.5);
  col += uSunCol*uSunInt*spec*sh*(0.03+0.55*uWet)*(0.25+fre);
  float pud = uWet * smoothstep(0.975,0.995,n.y) * smoothstep(0.45,0.7,fbm2(p.xz*0.6+7.0));
  if(pud > 0.005){
    vec3 rr = reflect(rd, n); rr.y = abs(rr.y);
    col = mix(col, skyColor(normalize(rr), false), pud*(0.35+0.6*fre));
  }
  return col;
}

/* ---------- 水面着色 ---------- */

vec3 shadeWater(vec3 p, vec3 rd){
  float tt = uTime*(0.5+uWind*1.5);
  vec2 q = p.xz*0.5;
  float e = 0.09;
  vec2 drift = vec2(tt*0.7, tt*0.4);
  float h0 = fbm2(q + drift);
  float hx = fbm2(q + vec2(e,0.0) + drift);
  float hz = fbm2(q + vec2(0.0,e) + drift);
  float dist = length(p - uCamPos);
  float damp = clamp(45.0/(45.0+dist), 0.15, 1.0);
  float ramp = 0.22*(0.25+uWind)*damp;
  float rainNx = uRain*(noise2(p.xz*3.0 + uTime*9.0)-0.5)*0.30*damp;
  float rainNz = uRain*(noise2(p.zx*3.0 - uTime*8.0)-0.5)*0.30*damp;
  vec3 n = normalize(vec3((h0-hx)/e*ramp + rainNx, 1.0, (h0-hz)/e*ramp + rainNz));

  vec3 rr = reflect(rd, n); rr.y = abs(rr.y)+0.02;
  vec3 refl = skyColor(normalize(rr), true)*0.92;
  float fre = clamp(0.03 + 0.97*pow(1.0+dot(rd,n), 5.0), 0.0, 1.0);
  vec3 deep = mix(vec3(0.035,0.07,0.055), uFogCol*0.25, clamp(uFogDens*40.0,0.0,1.0));
  vec3 col = mix(deep*(uAmb+0.25), refl, fre);
  vec3 hv = normalize(uSunDir - rd);
  col += uSunCol*uSunInt*pow(clamp(dot(n,hv),0.0,1.0), mix(600.0,80.0,uWind))*(2.0-uWind);
  col += vec3(0.8,0.85,1.0)*uFlash*0.6*fre;
  return col;
}

/* ---------- 屏幕空间：雨 / 雪 / 沙尘 / 镜头水珠 ---------- */

// 短划痕雨丝：每条粗细、亮度、相位随机，两端运动模糊
float rainLayer(vec2 p, float density, float dash){
  vec2 id = floor(p); vec2 f = fract(p);
  float rn = hash1v(id);
  if(rn > density) return 0.0;
  float xo = 0.2 + 0.6*fract(rn*91.37);
  float th = 0.03 + 0.04*fract(rn*37.71);
  float y0 = fract(rn*53.17)*(1.0-dash);
  float seg = smoothstep(y0, y0+dash*0.3, f.y) * smoothstep(y0+dash, y0+dash*0.7, f.y);
  float w = smoothstep(th, th*0.15, abs(f.x-xo));
  return w*seg*(0.35+0.65*fract(rn*17.31));
}

float rainStreaks(vec2 uv){
  float slant = uWind*(0.14+0.05*sin(uTime*0.83));   // 阵风摆动
  vec2 q = vec2(uv.x + uv.y*slant, uv.y);
  float r = rainLayer(vec2(q.x*22.0,         q.y*1.1 + uTime*11.0), 0.50, 0.85)*0.36
          + rainLayer(vec2(q.x*45.0  + 7.3,  q.y*2.0 + uTime*17.0), 0.55, 0.70)*0.26
          + rainLayer(vec2(q.x*90.0  + 19.7, q.y*3.6 + uTime*25.0), 0.65, 0.60)*0.18
          + rainLayer(vec2(q.x*160.0 + 31.1, q.y*6.0 + uTime*33.0), 0.75, 0.55)*0.12;
  return r;
}

float flakeLayer(vec2 p, float t, float density){
  p.y += t;
  p.x += sin(p.y*1.7)*0.15;
  vec2 id = floor(p); vec2 f = fract(p);
  float rn = hash1v(id);
  if(rn > density) return 0.0;
  vec2 c = vec2(0.25+0.5*fract(rn*13.7) + 0.15*sin(t*1.4+rn*40.0), 0.25+0.5*fract(rn*71.3));
  float r = 0.05+0.05*fract(rn*5.13);
  return smoothstep(r, r*0.25, length(f-c))*(0.4+0.6*fract(rn*9.71));
}

float snowFlakes(vec2 uv){
  return flakeLayer(uv*vec2(5.0,7.0),        uTime*0.7, 0.50)*0.50
       + flakeLayer(uv*vec2(9.0,13.0)+3.1,   uTime*1.0, 0.60)*0.35
       + flakeLayer(uv*vec2(16.0,22.0)+7.7,  uTime*1.5, 0.70)*0.25;
}

float dustStreaks(vec2 uv){
  vec2 q = vec2(uv.y, uv.x);
  float r = rainLayer(vec2(q.x*60.0,       q.y*1.8 - uTime*(6.0+uWind*16.0)), 0.45, 0.7)*0.6
          + rainLayer(vec2(q.x*34.0 + 5.7, q.y*1.1 - uTime*(4.0+uWind*10.0)), 0.35, 0.8)*0.4;
  return r;
}

// Heartfelt 式镜头水珠：主滴周期滑落 + 蜿蜒 + 上方尾迹微滴
vec2 dropTrail(vec2 g, float t){
  vec2 id = floor(g);
  float rn = hash1v(id);
  if(rn < 0.5) return vec2(0.0);
  vec2 f = fract(g);
  float ph = fract(t*(0.06+0.10*fract(rn*7.71)) + rn);
  float dy = 1.0 - ph;
  float dx = 0.5 + 0.26*sin(ph*12.6 + rn*40.0);
  vec2 dpos = f - vec2(dx, dy);
  float r = 0.07 + 0.05*fract(rn*3.31);
  float m = smoothstep(r, 0.0, length(dpos*vec2(1.0,0.85)));
  vec2 off = -dpos*m*2.2;
  for(int k=1;k<=3;k++){
    vec2 tp = f - vec2(dx - 0.02*float(k)*sin(rn*9.0), dy + 0.09*float(k));
    float tr = r*(1.0-0.22*float(k));
    off += -tp*smoothstep(tr,0.0,length(tp))*1.3;
  }
  return off;
}

/* ---------- 彩虹（角度空间，主虹 42° / 副虹 51°） ---------- */

vec3 spectral(float x){  // 0=紫 → 1=红
  return clamp(vec3(
    smoothstep(0.25,0.65,x) + smoothstep(0.14,0.0,x)*0.35,
    sin(3.14159*x)*0.85,
    smoothstep(0.5,0.1,x)
  ), 0.0, 1.0);
}

/* ---------- 色调 ---------- */

vec3 aces(vec3 x){
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0);
}

/* ---------- 主函数 ---------- */

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uvN = frag/uRes;
  vec2 uv = (2.0*frag - uRes)/uRes.y;

  // 镜头水珠 + 雨中空气扰动
  if(uWet > 0.02){
    vec2 off = dropTrail(uvN*vec2(6.0,9.0), uTime)
             + dropTrail(uvN*vec2(11.0,16.0)+3.7, uTime*1.3)*0.6;
    uv += off*uWet*0.35;
    uv.x += (noise2(uv*4.0 + uTime*3.0)-0.5)*0.006*uRain;
  }

  float cy = uYaw, cp = uPitch;
  vec3 fw = normalize(vec3(sin(cy)*cos(cp), sin(cp), -cos(cy)*cos(cp)));
  vec3 rt = normalize(cross(fw, vec3(0.0,1.0,0.0)));
  vec3 up = cross(rt, fw);
  vec3 ro = uCamPos;
  vec3 rd = normalize(uv.x*rt + uv.y*up + 1.45*uZoom*fw);

  float tmax = 1200.0;
  float tT = marchTerrain(ro, rd, tmax);
  float tW = (rd.y < -0.001) ? (WATER_Y - ro.y)/rd.y : -1.0;

  int id = 0; float t = -1.0;
  if(tT > 0.0){ id = 1; t = tT; }
  if(tW > 0.0 && (tT < 0.0 || tW < tT)){ id = 2; t = tW; }

  vec3 col;
  if(id == 0)      col = skyColor(rd, true);
  else if(id == 1) col = shadeTerrain(ro+rd*t, rd);
  else             col = shadeWater(ro+rd*t, rd);

  // 空气透视
  if(id != 0){
    float f = 1.0 - exp(-t*uAerial);
    float sd = clamp(dot(rd, uSunDir), 0.0, 1.0);
    vec3 aer = uAerialCol + uMieCol*uMie*0.25*pow(sd, 4.0);
    col = mix(col, aer, f);
  }

  // 体积云 → 龙卷风 → 体积尘雾
  vec4 cl = marchClouds(ro, rd, t);
  col = col*(1.0-cl.a) + cl.rgb;
  vec4 tn = marchTornado(ro, rd, t);
  col = col*tn.a + tn.rgb;
  float tf = (t > 0.0) ? min(t, 480.0) : 480.0;
  vec4 fg = marchFog(ro, rd, tf);
  col = col*fg.a + fg.rgb;

  // 彩虹：对日点 42° 主虹 + 51° 副虹 + 弓内增亮
  if(uRainbow > 0.005 && uSunDir.y > 0.05 && (id == 0 || t > 240.0)){
    float ang = degrees(acos(clamp(dot(rd, -uSunDir), -1.0, 1.0)));
    float vis = uRainbow * clamp(uSunInt*0.6, 0.0, 1.0) * smoothstep(-0.02,0.08,rd.y);
    float f1 = (ang - 40.6)/1.8;
    if(f1 > 0.0 && f1 < 1.0) col += spectral(f1)*sin(3.14159*f1)*0.42*vis;
    col += vec3(0.90,0.92,1.0)*smoothstep(40.6, 34.0, ang)*0.07*vis;
    float f2 = (ang - 50.2)/3.4;
    if(f2 > 0.0 && f2 < 1.0) col += spectral(1.0-f2)*sin(3.14159*f2)*0.10*vis;
  }

  // 闪电
  if(uFlash > 0.003 && uBoltOn > 0.5 && (id == 0 || t > 420.0)){
    float az = atan(rd.x, -rd.z);
    float dAz = mod(az - uBoltAz + 3.14159, 6.28318) - 3.14159;
    float y = rd.y;
    if(y > -0.05 && y < 0.55){
      float off  = (noise2(vec2(y*14.0, uBoltSeed))-0.5)*0.35*(0.25+y);
      float fade = smoothstep(0.55,0.45,y)*smoothstep(-0.05,0.02,y);
      col += vec3(0.75,0.82,1.0)*exp(-abs(dAz-off)*130.0)*fade*uFlash*7.0;
      float off2 = off + (noise2(vec2(y*23.0, uBoltSeed+7.0))-0.5)*0.55*y;
      col += vec3(0.70,0.78,1.0)*exp(-abs(dAz-off2)*320.0)*fade*uFlash*2.5;
    }
  }
  col += vec3(0.55,0.62,0.80)*uFlash*0.20;

  // 雨幕：亮度感知混合——暗背景上发亮，亮背景上变暗（散射）
  if(uRain > 0.01){
    float rl = rainStreaks(uv);
    float lum = dot(col, vec3(0.299,0.587,0.114));
    vec3 rcol = mix(vec3(0.72,0.78,0.88)*(uAmb+0.35), vec3(0.18,0.22,0.30), smoothstep(0.30,0.75,lum));
    rcol *= 1.0 + uFlash*5.0;
    col = mix(col, rcol, clamp(rl*uRain*0.65, 0.0, 1.0));
  }
  // 雪片
  if(uSnowfall > 0.01){
    float fl = snowFlakes(vec2(uv.x + uv.y*uWind*0.10, uv.y));
    col = mix(col, vec3(0.83,0.86,0.92)*(uAmb*0.9+0.30), clamp(fl*uSnowfall, 0.0, 1.0));
  }
  // 沙尘横扫
  if(uDustStreak > 0.01){
    float dl = dustStreaks(uv);
    col = mix(col, uFogCol*1.25, dl*uDustStreak*0.30);
  }

  // 色调
  col = aces(col*uExposure);
  col = pow(col, vec3(0.4545));
  float lum2 = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(lum2), col, uSat);
  vec2 vq = uvN - 0.5;
  col *= 1.0 - 0.5*dot(vq,vq);
  col += (hash1v(frag + fract(uTime*7.13)*271.7)-0.5)*0.028;

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------------- 渲染器与全屏四边形 ---------------- */

const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight, false);
container.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';

const uniforms = {
  uRes:       { value: new THREE.Vector2(1, 1) },
  uTime:      { value: 0 },
  uCloudTime: { value: 0 },
  uCamPos:    { value: new THREE.Vector3(0, 34, 26) },
  uYaw:       { value: 0 },
  uPitch:     { value: 0.05 },
  uSunDir:    { value: new THREE.Vector3(0, 1, 0) },
  uSunCol:    { value: new THREE.Vector3() },
  uSunInt:    { value: 1 },
  uDiscA:     { value: 0.005 },
  uDiscInt:   { value: 1 },
  uZenith:    { value: new THREE.Vector3() },
  uHorizon:   { value: new THREE.Vector3() },
  uMie:       { value: 0 },
  uMieCol:    { value: new THREE.Vector3() },
  uAmb:       { value: 0.4 },
  uAerial:    { value: 0.001 },
  uAerialCol: { value: new THREE.Vector3() },
  uNight:     { value: 0 },
  uCloudCover:{ value: 0.3 },
  uCloudAmb:  { value: 0.9 },
  uCloudDens: { value: 0.9 },
  uCloudBase: { value: 300 },
  uCloudDark: { value: new THREE.Vector3() },
  uFogDens:   { value: 0 },
  uFogH:      { value: 30 },
  uFogNoise:  { value: 0 },
  uFogCol:    { value: new THREE.Vector3() },
  uRain:      { value: 0 },
  uWet:       { value: 0 },
  uWind:      { value: 0.2 },
  uGrime:     { value: 0 },
  uGrimeCol:  { value: new THREE.Vector3() },
  uDustStreak:{ value: 0 },
  uSnowAmt:   { value: 0 },
  uSnowfall:  { value: 0 },
  uRainbow:   { value: 0 },
  uTornado:   { value: 0 },
  uSat:       { value: 1 },
  uExposure:  { value: 1.1 },
  uFlash:     { value: 0 },
  uBoltAz:    { value: 0 },
  uBoltSeed:  { value: 0 },
  uBoltOn:    { value: 0 },
  uZoom:      { value: 1 },
};

const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quadScene.add(new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  })
));

let resScale = 0.7;
function applySize() {
  const w = Math.round(window.innerWidth * resScale);
  const h = Math.round(window.innerHeight * resScale);
  renderer.setSize(w, h, false);
  uniforms.uRes.value.set(w, h);
}
applySize();
window.addEventListener('resize', applySize);
window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') {
    resScale = resScale > 0.85 ? 0.5 : resScale > 0.6 ? 1.0 : 0.7;
    applySize();
  }
});

/* ---------------- 天气预设（对昼夜基准的调制 + 自身参数） ---------------- */

const PRESETS = {
  sunny: {
    skyDesat: 0, skyBright: 1.0, skyTint: [1, 1, 1],
    sunIntMul: 1, discIntMul: 1, discAMul: 1, mieMul: 1, ambMul: 1, starMul: 1, azOff: 0,
    cloudCover: 0.42, cloudAmb: 0.9, cloudDens: 0.9, cloudSpeed: 1.0, cloudBase: 320, cloudDark: [0.30, 0.34, 0.40],
    fogDens: 0, fogH: 30, fogNoise: 0, fogCol: [0.80, 0.85, 0.90], aerial: 0.0011,
    rain: 0, wet: 0, wind: 0.25, grime: 0, grimeCol: [0.55, 0.42, 0.26], dustStreak: 0,
    snowAmt: 0, snowfall: 0, rainbow: 0, tornado: 0,
    sat: 1.0, exposure: 1.06, lightning: 0,
  },
  overcast: {
    skyDesat: 0.75, skyBright: 0.85, skyTint: [1, 1, 1.02],
    sunIntMul: 0.22, discIntMul: 0.04, discAMul: 2, mieMul: 0.15, ambMul: 2.3, starMul: 0.2, azOff: 0,
    cloudCover: 0.98, cloudAmb: 0.62, cloudDens: 1.3, cloudSpeed: 1.6, cloudBase: 240, cloudDark: [0.42, 0.45, 0.50],
    fogDens: 0.0002, fogH: 60, fogNoise: 0.15, fogCol: [0.60, 0.63, 0.67], aerial: 0.0014,
    rain: 0, wet: 0.08, wind: 0.45, grime: 0, grimeCol: [0.55, 0.42, 0.26], dustStreak: 0,
    snowAmt: 0, snowfall: 0, rainbow: 0, tornado: 0,
    sat: 0.82, exposure: 1.02, lightning: 0,
  },
  storm: {
    skyDesat: 0.6, skyBright: 0.34, skyTint: [0.9, 0.95, 1.05],
    sunIntMul: 0.08, discIntMul: 0, discAMul: 1, mieMul: 0.1, ambMul: 1.5, starMul: 0.05, azOff: 0,
    cloudCover: 1.0, cloudAmb: 0.30, cloudDens: 1.5, cloudSpeed: 3.4, cloudBase: 210, cloudDark: [0.16, 0.18, 0.22],
    fogDens: 0.0016, fogH: 45, fogNoise: 0.4, fogCol: [0.30, 0.34, 0.39], aerial: 0.0030,
    rain: 1, wet: 1, wind: 1.0, grime: 0, grimeCol: [0.55, 0.42, 0.26], dustStreak: 0,
    snowAmt: 0, snowfall: 0, rainbow: 0, tornado: 0,
    sat: 0.78, exposure: 1.0, lightning: 1,
  },
  sandstorm: {
    skyDesat: 0.25, skyBright: 0.75, skyTint: [1.25, 0.78, 0.38],
    sunIntMul: 0.32, discIntMul: 0.14, discAMul: 4, mieMul: 3, ambMul: 1.6, starMul: 0.05, azOff: 0,
    cloudCover: 0.15, cloudAmb: 0.6, cloudDens: 0.5, cloudSpeed: 4.5, cloudBase: 420, cloudDark: [0.45, 0.33, 0.20],
    fogDens: 0.008, fogH: 34, fogNoise: 0.85, fogCol: [0.74, 0.52, 0.28], aerial: 0.0045,
    rain: 0, wet: 0, wind: 1.0, grime: 0.7, grimeCol: [0.55, 0.42, 0.26], dustStreak: 1,
    snowAmt: 0, snowfall: 0, rainbow: 0, tornado: 0,
    sat: 1.0, exposure: 1.05, lightning: 0,
  },
  haze: {
    skyDesat: 0.55, skyBright: 0.66, skyTint: [1.10, 1.00, 0.78],
    sunIntMul: 0.5, discIntMul: 0.11, discAMul: 2.5, mieMul: 1.1, ambMul: 1.7, starMul: 0.15, azOff: 0,
    cloudCover: 0.35, cloudAmb: 0.6, cloudDens: 0.5, cloudSpeed: 0.6, cloudBase: 300, cloudDark: [0.50, 0.48, 0.43],
    fogDens: 0.0035, fogH: 55, fogNoise: 0.2, fogCol: [0.55, 0.50, 0.39], aerial: 0.0028,
    rain: 0, wet: 0, wind: 0.12, grime: 0.3, grimeCol: [0.50, 0.44, 0.30], dustStreak: 0.15,
    snowAmt: 0, snowfall: 0, rainbow: 0, tornado: 0,
    sat: 0.62, exposure: 1.0, lightning: 0,
  },
  snow: {
    skyDesat: 0.7, skyBright: 0.8, skyTint: [0.95, 1.0, 1.08],
    sunIntMul: 0.3, discIntMul: 0.06, discAMul: 2, mieMul: 0.2, ambMul: 2.2, starMul: 0.3, azOff: 0,
    cloudCover: 0.92, cloudAmb: 0.7, cloudDens: 1.2, cloudSpeed: 1.2, cloudBase: 260, cloudDark: [0.45, 0.47, 0.52],
    fogDens: 0.0009, fogH: 60, fogNoise: 0.2, fogCol: [0.72, 0.75, 0.80], aerial: 0.0018,
    rain: 0, wet: 0, wind: 0.3, grime: 0, grimeCol: [0.55, 0.42, 0.26], dustStreak: 0,
    snowAmt: 1, snowfall: 1, rainbow: 0, tornado: 0,
    sat: 0.8, exposure: 1.06, lightning: 0,
  },
  tornado: {
    skyDesat: 0.5, skyBright: 0.42, skyTint: [0.95, 1.02, 0.90],
    sunIntMul: 0.1, discIntMul: 0, discAMul: 1, mieMul: 0.15, ambMul: 1.6, starMul: 0.05, azOff: 0,
    cloudCover: 1.0, cloudAmb: 0.32, cloudDens: 1.7, cloudSpeed: 4.5, cloudBase: 200, cloudDark: [0.15, 0.18, 0.155],
    fogDens: 0.0012, fogH: 40, fogNoise: 0.5, fogCol: [0.35, 0.37, 0.33], aerial: 0.0028,
    rain: 0.3, wet: 0.6, wind: 1.0, grime: 0.1, grimeCol: [0.50, 0.42, 0.30], dustStreak: 0.3,
    snowAmt: 0, snowfall: 0, rainbow: 0, tornado: 1,
    sat: 0.8, exposure: 0.98, lightning: 1,
  },
  rainbow: {
    skyDesat: 0.1, skyBright: 1.0, skyTint: [1, 1, 1],
    sunIntMul: 0.9, discIntMul: 0.8, discAMul: 1, mieMul: 0.8, ambMul: 1.1, starMul: 0.8, azOff: 180,
    cloudCover: 0.5, cloudAmb: 0.85, cloudDens: 1.0, cloudSpeed: 1.3, cloudBase: 300, cloudDark: [0.35, 0.38, 0.43],
    fogDens: 0.0006, fogH: 40, fogNoise: 0.3, fogCol: [0.65, 0.72, 0.80], aerial: 0.0016,
    rain: 0.12, wet: 0.55, wind: 0.35, grime: 0, grimeCol: [0.55, 0.42, 0.26], dustStreak: 0,
    snowAmt: 0, snowfall: 0, rainbow: 1, tornado: 0,
    sat: 1.05, exposure: 1.08, lightning: 0,
  },
};

const WEATHERS = [
  { id: 'sunny', icon: '☀️', label: '晴天', en: 'Sunny', accent: '#ffb938',
    desc: '干洁大气：天空颜色随时间轴流转——正午深蓝、傍晚金橙、夜晚星河与月光。强直射阳光在侵蚀山脊上拉出软阴影。',
    stats: [['能见度', '30 km'], ['风力', '2 级'], ['降水', '无'], ['PM2.5', '12']] },
  { id: 'overcast', icon: '☁️', label: '阴天', en: 'Overcast', accent: '#9fb3c8',
    desc: '满覆盖层积云把太阳变成巨大柔光箱：直射光衰减、阴影消散，体积云底的明暗起伏成为画面主角。',
    stats: [['能见度', '15 km'], ['风力', '3 级'], ['降水', '无'], ['云量', '98%']] },
  { id: 'storm', icon: '⛈️', label: '雷雨', en: 'Thunderstorm', accent: '#5d7feb',
    desc: '低垂积雨云与四层视差雨幕：雨丝在暗处发亮、亮处变暗，镜头水珠蜿蜒滑落，闪电瞬间照亮雨幕与湖面。',
    stats: [['能见度', '4 km'], ['风力', '7 级'], ['降水', '大雨'], ['雷电', '频繁']] },
  { id: 'sandstorm', icon: '🏜️', label: '沙尘暴', en: 'Sandstorm', accent: '#e0913f',
    desc: '高浓度沙尘的强 Mie 前向散射把天空染橙，体积尘雾随风翻滚推进，太阳退成昏黄圆盘，沙粒横扫镜头。',
    stats: [['能见度', '500 m'], ['风力', '9 级'], ['PM10', '> 2000'], ['太阳', '昏黄']] },
  { id: 'haze', icon: '🌫️', label: '雾霾', en: 'Hazy / Smog', accent: '#b0a98f',
    desc: '细颗粒物均匀散射，对比度与饱和度同时塌缩：远山一层层没入灰黄，太阳是一枚苍白圆盘。',
    stats: [['能见度', '1.5 km'], ['风力', '1 级'], ['PM2.5', '> 300'], ['AQI', '严重污染']] },
  { id: 'snow', icon: '🌨️', label: '雪天', en: 'Snowfall', accent: '#9fc8e8',
    desc: '冷锋过境：雪片随风摆落，积雪沿坡度覆盖山谷与缓坡，世界被压成低饱和的灰蓝与白。夜晚雪原映着月光。',
    stats: [['气温', '-6°C'], ['积雪', '12 cm'], ['风力', '3 级'], ['能见度', '8 km']] },
  { id: 'tornado', icon: '🌪️', label: '龙卷风', en: 'Tornado', accent: '#7d9466',
    desc: '超级单体：云底压至两百米，旋转上升气流在云地之间拉出体积漏斗，底部翻滚着碎屑尘云，外围横风裹挟雨幕。',
    stats: [['等级', 'EF3'], ['风速', '70 m/s'], ['气压', '骤降'], ['雷电', '频繁']] },
  { id: 'rainbow', icon: '🌈', label: '彩虹', en: 'Rainbow', accent: '#ff8bc2',
    desc: '雨后初晴：阳光从身后射入残余雨幕，对日点 42° 散出主虹、51° 副虹与弓内增亮。太阳越低虹越高——试试傍晚。',
    stats: [['主虹', '42°'], ['副虹', '51°'], ['湿度', '高'], ['能见度', '25 km']] },
];

/* ---------------- 昼夜基准 + 天气调制 → 目标状态 ---------------- */

const sm = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
const mixA = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

const DAY_ZEN = [0.07, 0.22, 0.52], DAY_HOR = [0.58, 0.72, 0.88];
const DUSK_ZEN = [0.10, 0.13, 0.30], DUSK_HOR = [0.98, 0.48, 0.20];
const NIGHT_ZEN = [0.004, 0.007, 0.018], NIGHT_HOR = [0.018, 0.026, 0.052];

function computeTarget(p, hour) {
  const sunEl = 78 * Math.sin(Math.PI * (hour - 6) / 12);
  const sunAz = -65 + (hour - 6) / 12 * 130;
  const mh = (hour + 24 - 18) % 24;
  const moonEl = 60 * Math.sin(Math.PI * mh / 12);
  const moonAz = -65 + mh / 12 * 130;

  const dayW = sm(-10, 15, sunEl);
  const nightW = 1 - sm(-14, 2, sunEl);
  const lowW = sm(30, 4, Math.max(sunEl, 0));
  const duskW = Math.exp(-Math.pow((sunEl - 3) / 11, 2));
  const useMoon = moonEl > sunEl && sunEl < 4;

  let zen = mixA(NIGHT_ZEN, DAY_ZEN, dayW);
  zen = mixA(zen, DUSK_ZEN, duskW * 0.55);
  let hor = mixA(NIGHT_HOR, DAY_HOR, dayW);
  hor = mixA(hor, DUSK_HOR, duskW * 0.8);

  const grade = (c) => {
    const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    return c.map((v, i) => (l + (v - l) * (1 - p.skyDesat)) * p.skyBright * p.skyTint[i]);
  };
  zen = grade(zen); hor = grade(hor);

  const sunCol = useMoon ? [0.55, 0.66, 0.88] : mixA([1.0, 0.93, 0.80], [1.0, 0.42, 0.15], lowW);
  const sunInt = (useMoon ? 0.5 * sm(-3, 10, moonEl) : 2.9 * sm(-3, 12, sunEl)) * p.sunIntMul;
  const amb = Math.min(Math.max((0.07 + 0.33 * dayW + 0.05 * duskW) * p.ambMul, 0.04), 0.95);
  let mie = (useMoon ? 0.07 : 0.45 + 1.5 * duskW * (1 - nightW)) * p.mieMul;
  mie = Math.min(mie, 2.2);
  const mieCol = useMoon ? [0.5, 0.6, 0.8] : mixA([1.0, 0.78, 0.50], [1.0, 0.40, 0.16], duskW);

  return {
    sunEl: useMoon ? moonEl : sunEl,
    sunAz: (useMoon ? moonAz : sunAz) + p.azOff,
    zenith: zen, horizon: hor, aerialCol: hor.map(v => v * 0.95),
    sunCol, sunInt, amb, mie, mieCol,
    discA: (useMoon ? 0.0045 : 0.0045 + 0.005 * lowW) * p.discAMul,
    discInt: (useMoon ? 2.6 : 5.0 - 1.5 * lowW) * p.discIntMul,
    night: nightW * p.starMul,
    aerial: p.aerial,
    cloudCover: p.cloudCover, cloudAmb: p.cloudAmb, cloudDens: p.cloudDens,
    cloudBase: p.cloudBase, cloudDark: p.cloudDark, cloudSpeed: p.cloudSpeed,
    fogDens: p.fogDens, fogH: p.fogH, fogNoise: p.fogNoise, fogCol: p.fogCol,
    rain: p.rain, wet: p.wet, wind: p.wind, grime: p.grime, grimeCol: p.grimeCol,
    dustStreak: p.dustStreak, snowAmt: p.snowAmt, snowfall: p.snowfall,
    rainbow: p.rainbow, tornado: p.tornado,
    sat: p.sat, exposure: p.exposure * (1 + 0.35 * nightW),
    lightning: p.lightning,
  };
}

function materialize(o) {
  const out = {};
  for (const k in o) out[k] = Array.isArray(o[k]) ? new THREE.Vector3(...o[k]) : o[k];
  return out;
}

let hour = 13;
let weatherId = 'sunny';
const cur = materialize(computeTarget(PRESETS.sunny, hour));
let target = materialize(computeTarget(PRESETS.sunny, hour));

function refreshTarget() {
  target = materialize(computeTarget(PRESETS[weatherId], hour));
}

function lerpState(dt) {
  const k = 1 - Math.exp(-dt * 1.6);
  for (const key in cur) {
    if (cur[key] instanceof THREE.Vector3) cur[key].lerp(target[key], k);
    else cur[key] += (target[key] - cur[key]) * k;
  }
}

const UNIFORM_MAP = {
  zenith: 'uZenith', horizon: 'uHorizon', sunCol: 'uSunCol', sunInt: 'uSunInt',
  discA: 'uDiscA', discInt: 'uDiscInt', mie: 'uMie', mieCol: 'uMieCol',
  amb: 'uAmb', aerial: 'uAerial', aerialCol: 'uAerialCol', night: 'uNight',
  cloudCover: 'uCloudCover', cloudAmb: 'uCloudAmb', cloudDens: 'uCloudDens',
  cloudBase: 'uCloudBase', cloudDark: 'uCloudDark',
  fogDens: 'uFogDens', fogH: 'uFogH', fogNoise: 'uFogNoise', fogCol: 'uFogCol',
  rain: 'uRain', wet: 'uWet', wind: 'uWind', grime: 'uGrime', grimeCol: 'uGrimeCol',
  dustStreak: 'uDustStreak', snowAmt: 'uSnowAmt', snowfall: 'uSnowfall',
  rainbow: 'uRainbow', tornado: 'uTornado',
  sat: 'uSat', exposure: 'uExposure',
};

function applyState() {
  for (const k in UNIFORM_MAP) {
    const u = uniforms[UNIFORM_MAP[k]];
    if (cur[k] instanceof THREE.Vector3) u.value.copy(cur[k]);
    else u.value = cur[k];
  }
  const el = THREE.MathUtils.degToRad(cur.sunEl);
  const az = THREE.MathUtils.degToRad(cur.sunAz);
  uniforms.uSunDir.value.set(
    Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)
  );
}

/* ---------------- 闪电状态机 ---------------- */

const bolt = { active: false, t: 0, dur: 0.5, next: 3.0 };
function updateLightning(dt) {
  const stormy = cur.lightning > 0.55;
  if (stormy && !bolt.active) {
    bolt.next -= dt;
    if (bolt.next <= 0) {
      bolt.active = true;
      bolt.t = 0;
      bolt.dur = 0.35 + Math.random() * 0.3;
      uniforms.uBoltSeed.value = Math.random() * 100;
      uniforms.uBoltAz.value = cam.yaw + (Math.random() - 0.5) * 1.1;
    }
  }
  if (!bolt.active) { uniforms.uFlash.value = 0; uniforms.uBoltOn.value = 0; return; }
  bolt.t += dt;
  const k = bolt.t / bolt.dur;
  if (k >= 1) {
    bolt.active = false;
    bolt.next = 1.5 + Math.random() * 5.0;
    uniforms.uFlash.value = 0;
    uniforms.uBoltOn.value = 0;
    return;
  }
  const env = (1 - k) * (0.45 + 0.55 * Math.pow(Math.abs(Math.sin(k * 26)), 3));
  uniforms.uFlash.value = env;
  uniforms.uBoltOn.value = k < 0.45 ? 1 : 0;
}

/* ---------------- 相机 ---------------- */

const cam = { yaw: 0, pitch: 0.05, auto: true, dragging: false, lx: 0, ly: 0 };
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  cam.dragging = true; cam.auto = false;
  cam.lx = e.clientX; cam.ly = e.clientY;
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!cam.dragging) return;
  cam.yaw -= (e.clientX - cam.lx) * 0.003;
  cam.pitch += (e.clientY - cam.ly) * 0.002;
  cam.pitch = Math.max(-0.45, Math.min(0.4, cam.pitch));
  cam.lx = e.clientX; cam.ly = e.clientY;
});
cv.addEventListener('pointerup', () => { cam.dragging = false; });
// 滚轮缩放视野（调整焦距）
let zoomTarget = 1;
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomTarget = Math.min(3.2, Math.max(0.65, zoomTarget * Math.exp(-e.deltaY * 0.0012)));
}, { passive: false });

/* ---------------- UI：天气 Tab ---------------- */

const tabsEl = document.getElementById('tabs');
const infoName = document.getElementById('info-name');
const infoEn = document.getElementById('info-en');
const infoDesc = document.getElementById('info-desc');
const statsEl = document.getElementById('stats');
const tabBtns = [];

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function setWeather(id) {
  const w = WEATHERS.find(x => x.id === id);
  if (!w) return;
  weatherId = id;
  // 彩虹需要低太阳角：太阳过高时自动拨到傍晚
  if (id === 'rainbow') {
    const el = 78 * Math.sin(Math.PI * (hour - 6) / 12);
    if (el > 36 || el < 2) setHour(16.6);
  }
  refreshTarget();
  document.documentElement.style.setProperty('--accent', w.accent);
  for (const b of tabBtns) {
    const on = b.dataset.id === id;
    b.classList.toggle('active', on);
    b.style.setProperty('--tab-bg', on ? hexToRgba(w.accent, 0.28) : '');
  }
  infoName.textContent = `${w.icon} ${w.label}`;
  infoEn.textContent = w.en;
  infoDesc.textContent = w.desc;
  statsEl.innerHTML = '';
  for (const [kk, vv] of w.stats) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = kk;
    const b = document.createElement('b');
    b.textContent = vv;
    chip.appendChild(b);
    statsEl.appendChild(chip);
  }
}

WEATHERS.forEach((w, i) => {
  const btn = document.createElement('button');
  btn.className = 'tab';
  btn.dataset.id = w.id;
  btn.innerHTML = `<span class="ico">${w.icon}</span>${w.label}<span class="key">${i + 1}</span>`;
  btn.addEventListener('click', () => setWeather(w.id));
  tabsEl.appendChild(btn);
  tabBtns.push(btn);
});

window.addEventListener('keydown', (e) => {
  const i = parseInt(e.key, 10) - 1;
  if (i >= 0 && i < WEATHERS.length) setWeather(WEATHERS[i].id);
});

/* ---------------- UI：时间轴 ---------------- */

const tslider = document.getElementById('tslider');
const tlabel = document.getElementById('tlabel');
const tplay = document.getElementById('tplay');
let playing = false;

function fmtHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function timeIcon(h) {
  if (h < 5.5 || h >= 19.5) return '🌙';
  if (h < 8) return '🌅';
  if (h < 17) return '☀️';
  return '🌇';
}
function setHour(h) {
  hour = ((h % 24) + 24) % 24;
  tslider.value = hour;
  tlabel.textContent = `${timeIcon(hour)} ${fmtHour(hour)}`;
  refreshTarget();
}
tslider.addEventListener('input', () => setHour(parseFloat(tslider.value)));
tplay.addEventListener('click', () => {
  playing = !playing;
  tplay.textContent = playing ? '⏸' : '▶';
});

/* ---------------- 启动参数 ?w= ?t= ---------------- */

{
  const params = new URLSearchParams(location.search);
  const q = params.get('w');
  const tq = parseFloat(params.get('t'));
  if (Number.isFinite(tq)) hour = ((tq % 24) + 24) % 24;
  setHour(hour);
  setWeather(PRESETS[q] ? q : 'sunny');
  if (q || Number.isFinite(tq)) Object.assign(cur, materialize(computeTarget(PRESETS[weatherId], hour)));
}

/* ---------------- 主循环 ---------------- */

const clock = new THREE.Clock();
let cloudTime = 0;
let emaFrame = 16, frames = 0;

renderer.setAnimationLoop(() => {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;

  emaFrame = emaFrame * 0.95 + Math.min(rawDt * 1000, 100) * 0.05;
  if (++frames % 120 === 0 && emaFrame > 40 && resScale > 0.45) {
    resScale = Math.max(0.45, resScale - 0.15);
    applySize();
  }

  if (playing) setHour(hour + dt * 24 / 20);   // 20 秒一整天（时间流速 ×2）

  lerpState(dt);
  cloudTime += dt * cur.cloudSpeed;
  uniforms.uTime.value = t;
  uniforms.uCloudTime.value = cloudTime;

  if (cam.auto) cam.yaw = 0.18 * Math.sin(t * 0.05);
  uniforms.uYaw.value = cam.yaw;
  uniforms.uPitch.value = cam.pitch;
  uniforms.uZoom.value += (zoomTarget - uniforms.uZoom.value) * Math.min(dt * 8, 1);

  applyState();
  updateLightning(dt);

  renderer.render(quadScene, quadCam);
});
