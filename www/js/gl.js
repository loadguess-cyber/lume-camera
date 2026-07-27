/* ══════════════════════════════════════════════════════════
   gl.js — 실시간 프리셋 렌더링 엔진 (WebGL)
   라이트룸 현상 파이프라인을 GPU 셰이더로 근사합니다.
     화이트밸런스 → 노출 → 영역별 밝기 → 대비 → 국소대비/안개제거
     → 톤커브(LUT) → HSL 8채널 → 생동감/채도 → 컬러그레이딩
     → 페이드 → 비네팅 → 그레인
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* HSL 8밴드의 중심 색상각과 폭 (라이트룸 밴드에 맞춤) */
  var BAND_C = [0, 30, 55, 105, 175, 225, 275, 320];
  var BAND_W = [46, 40, 45, 70, 70, 60, 55, 50];

  var VERT = [
    'attribute vec2 aPos;',
    'uniform vec2 uScale;',
    'uniform vec2 uOffset;',
    'uniform float uFlipX;',
    'varying vec2 vUV;',
    'void main(){',
    '  vec2 uv = aPos * 0.5 + 0.5;',
    '  uv.y = 1.0 - uv.y;',
    '  uv.x = mix(uv.x, 1.0 - uv.x, uFlipX);',
    '  vUV = (uv - 0.5) * uScale + 0.5 + uOffset;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'varying vec2 vUV;',
    'uniform sampler2D uTex;',
    'uniform sampler2D uCurve;',
    'uniform vec2  uTexel;',
    'uniform float uAmount;',
    'uniform float uTime;',
    'uniform float uHasCurve;',
    'uniform float uHasLocal;',
    'uniform float uLetterbox;',   // 1 = 사진 바깥을 검게 칠한다 (contain)
    'uniform float uMono;',
    'uniform vec3  uAWB;',     // 자동 화이트밸런스 채널 게인 (기본 1,1,1 = 보정 없음)
    'uniform vec4  uWB;',      // temp, tint, exposure(EV), contrast
    'uniform vec4  uTone;',    // highlights, shadows, whites, blacks
    'uniform vec3  uLocal;',   // texture, clarity, dehaze
    'uniform vec2  uSatV;',    // vibrance, saturation
    'uniform vec3  uHSL[8];',
    'uniform float uBandC[8];',
    'uniform float uBandW[8];',
    'uniform vec3  uGSh;',
    'uniform vec3  uGMid;',
    'uniform vec3  uGHi;',
    'uniform vec3  uGGl;',
    'uniform vec4  uGLum;',    // shadow, mid, high, global
    'uniform vec2  uGMix;',    // balance, blending
    'uniform vec3  uVig;',     // amount, midpoint, feather
    'uniform vec2  uGrainP;',  // amount, size
    'uniform vec2  uFadeSh;',  // fade, sharpen
    '',
    'const vec3 LW = vec3(0.2126, 0.7152, 0.0722);',
    'float luma(vec3 c){ return dot(c, LW); }',
    '',
    'vec3 rgb2hsv(vec3 c){',
    '  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);',
    '  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));',
    '  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));',
    '  float d = q.x - min(q.w, q.y);',
    '  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);',
    '}',
    'vec3 hsv2rgb(vec3 c){',
    '  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);',
    '  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
    '  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',
    '',
    'vec3 blurAt(vec2 uv, vec2 r){',
    '  vec3 s = texture2D(uTex, uv).rgb * 0.28;',
    '  s += texture2D(uTex, uv + vec2( r.x,  r.y)).rgb * 0.18;',
    '  s += texture2D(uTex, uv + vec2(-r.x,  r.y)).rgb * 0.18;',
    '  s += texture2D(uTex, uv + vec2( r.x, -r.y)).rgb * 0.18;',
    '  s += texture2D(uTex, uv + vec2(-r.x, -r.y)).rgb * 0.18;',
    '  return s;',
    '}',
    '',
    'void main(){',
    '  /* contain 으로 그릴 때 사진이 닿지 않는 자리 — 가장자리 픽셀이 늘어나 보이지',
    '     않도록 검게 둡니다 (cover 로 그릴 때는 vUV 가 0~1 을 벗어나지 않습니다) */',
    '  if (uLetterbox > 0.5 &&',
    '      (vUV.x < 0.0 || vUV.x > 1.0 || vUV.y < 0.0 || vUV.y > 1.0)) {',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
    '    return;',
    '  }',
    '  vec3 raw = texture2D(uTex, vUV).rgb;',
    '',
    '  /* 0. 자동 화이트밸런스 — 선형 공간에서 채널 게인.',
    '        프리셋보다 앞이며 프리셋 강도(uAmount)의 영향을 받지 않습니다.',
    '        카메라 보정이지 프리셋의 일부가 아니기 때문입니다. */',
    '  vec3 src = pow(max(pow(max(raw, 0.0), vec3(2.2)) * uAWB, 0.0), vec3(1.0 / 2.2));',
    '  vec3 c = src;',
    '',
    '  /* 1. 선형화 → 화이트밸런스 → 노출 */',
    '  vec3 lin = pow(max(c, 0.0), vec3(2.2));',
    '  float tK = uWB.x, tT = uWB.y;',
    '  lin.r *= 1.0 + 0.32 * tK + 0.06 * tT;',
    '  lin.g *= 1.0 - 0.11 * tT;',
    '  lin.b *= 1.0 - 0.30 * tK + 0.06 * tT;',
    '  lin *= exp2(uWB.z);',
    '  c = pow(max(lin, 0.0), vec3(1.0 / 2.2));',
    '',
    '  /* 2. 밝은 영역 / 어두운 영역 / 흰색 / 검정 */',
    '  float l0 = luma(c);',
    '  float mSh = 1.0 - smoothstep(0.0, 0.55, l0);',
    '  float mHi = smoothstep(0.45, 1.0, l0);',
    '  float mBl = 1.0 - smoothstep(0.0, 0.28, l0);',
    '  float mWh = smoothstep(0.72, 1.0, l0);',
    '  c += uTone.x * 0.38 * mHi + uTone.y * 0.42 * mSh',
    '     + uTone.z * 0.30 * mWh + uTone.w * 0.34 * mBl;',
    '  c = clamp(c, 0.0, 1.0);',
    '',
    '  /* 3. 대비 */',
    '  float k = uWB.w;',
    '  vec3 sc = smoothstep(vec3(0.0), vec3(1.0), c);',
    '  vec3 fc = (c - 0.5) * 0.55 + 0.5;',
    '  c = mix(c, mix(fc, sc, step(0.0, k)), min(abs(k), 1.0));',
    '',
    '  /* 4. 텍스처 · 부분대비 · 안개제거 · 선명도 */',
    '  if (uHasLocal > 0.5) {',
    '    vec3 nearB = blurAt(vUV, uTexel * 1.6);',
    '    vec3 farB  = blurAt(vUV, uTexel * 7.0);',
    '    float lc = luma(c);',
    '    float dn = lc - luma(nearB);',
    '    float df = lc - luma(farB);',
    '    float midMask = clamp(1.0 - abs(lc - 0.5) * 1.35, 0.0, 1.0);',
    '    c += dn * (uLocal.x * 1.4 + uFadeSh.y * 1.1);',
    '    c += df * uLocal.y * 1.15 * midMask;',
    '    float dz = uLocal.z;',
    '    c = (c - 0.12 * dz) / max(1.0 - 0.26 * dz, 0.25);',
    '    c = clamp(c, 0.0, 1.0);',
    '  }',
    '',
    '  /* 5. 톤커브 (256픽셀 LUT: R=마스터, G/B/A=R/G/B 채널) */',
    '  if (uHasCurve > 0.5) {',
    '    c = clamp(c, 0.0, 1.0);',
    '    c.r = texture2D(uCurve, vec2(c.r, 0.5)).r;',
    '    c.g = texture2D(uCurve, vec2(c.g, 0.5)).r;',
    '    c.b = texture2D(uCurve, vec2(c.b, 0.5)).r;',
    '    c.r = texture2D(uCurve, vec2(c.r, 0.5)).g;',
    '    c.g = texture2D(uCurve, vec2(c.g, 0.5)).b;',
    '    c.b = texture2D(uCurve, vec2(c.b, 0.5)).a;',
    '  }',
    '',
    '  /* 6. HSL 8채널 */',
    '  vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));',
    '  float hdeg = hsv.x * 360.0;',
    '  float ah = 0.0, as = 0.0, al = 0.0, wsum = 0.0;',
    '  for (int i = 0; i < 8; i++) {',
    '    float d = abs(mod(hdeg - uBandC[i] + 540.0, 360.0) - 180.0);',
    '    float w = 1.0 - smoothstep(0.0, uBandW[i], d);',
    '    wsum += w;',
    '    ah += w * uHSL[i].x;',
    '    as += w * uHSL[i].y;',
    '    al += w * uHSL[i].z;',
    '  }',
    '  /* 이웃 밴드가 겹쳐 보정량이 두 배로 먹지 않도록 정규화 */',
    '  float wn = max(wsum, 1.0);',
    '  ah /= wn; as /= wn; al /= wn;',
    '  float sMask = smoothstep(0.02, 0.17, hsv.y);',
    '  hsv.x = fract(hsv.x + ah * 0.0722 * sMask);',
    '  hsv.y = clamp(hsv.y * (1.0 + as * sMask), 0.0, 1.0);',
    '  hsv.z = clamp(hsv.z * (1.0 + al * 0.45 * sMask), 0.0, 1.0);',
    '',
    '  /* 7. 생동감 · 채도 */',
    '  hsv.y = clamp(hsv.y * (1.0 + uSatV.x * (1.0 - hsv.y) * 1.3), 0.0, 1.0);',
    '  hsv.y = clamp(hsv.y * (1.0 + uSatV.y), 0.0, 1.0);',
    '  c = hsv2rgb(hsv);',
    '',
    '  /* 8. 흑백 변환 */',
    '  c = mix(c, vec3(luma(c)), uMono);',
    '',
    '  /* 9. 컬러 그레이딩 */',
    '  float lg = luma(c);',
    '  float pivot = clamp(0.5 + uGMix.x * 0.32, 0.12, 0.88);',
    '  float wS = 1.0 - smoothstep(0.0, pivot, lg);',
    '  float wH = smoothstep(pivot, 1.0, lg);',
    '  float wM = clamp(1.0 - wS - wH, 0.0, 1.0);',
    '  vec3 grade = uGSh * wS + uGMid * wM + uGHi * wH + uGGl;',
    '  c += grade * (0.45 + uGMix.y * 0.85);',
    '  c *= 1.0 + uGLum.x * wS * 0.6 + uGLum.y * wM * 0.6',
    '           + uGLum.z * wH * 0.6 + uGLum.w * 0.5;',
    '',
    '  /* 10. 페이드 */',
    '  c = c * (1.0 - uFadeSh.x * 0.34) + uFadeSh.x * 0.115;',
    '',
    '  /* 11. 비네팅 */',
    '  float rr = length(vUV - 0.5) / 0.7071;',
    '  float vg = smoothstep(uVig.y, min(uVig.y + max(uVig.z, 0.05), 1.45), rr);',
    '  c *= 1.0 + uVig.x * vg;',
    '',
    '  /* 12. 그레인 */',
    '  if (uGrainP.x > 0.001) {',
    '    vec2 gp = floor((vUV / max(uTexel, vec2(1e-6))) / max(uGrainP.y, 0.5));',
    '    float n = fract(sin(dot(gp, vec2(12.9898, 78.233)) + uTime) * 43758.5453);',
    '    float shM = 1.0 - smoothstep(0.15, 0.95, luma(c));',
    '    c += (n - 0.5) * uGrainP.x * 0.22 * (0.35 + shM * 0.65);',
    '  }',
    '',
    '  gl_FragColor = vec4(clamp(mix(src, c, uAmount), 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* ══════════════ 커브 LUT 계산 (CPU) ══════════════ */

  /* 단조 3차 보간 (Fritsch–Carlson) — 오버슈트 없이 부드럽게 */
  function monotoneSpline(pts) {
    var n = pts.length;
    var xs = new Array(n), ys = new Array(n);
    for (var i = 0; i < n; i++) { xs[i] = pts[i][0]; ys[i] = pts[i][1]; }

    var d = new Array(n - 1), m = new Array(n);
    for (i = 0; i < n - 1; i++) {
      var dx = xs[i + 1] - xs[i];
      d[i] = dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx;
    }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else m[i] = (d[i - 1] + d[i]) / 2;
    }
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i];
      var s = a * a + b * b;
      if (s > 9) {
        var tf = 3 / Math.sqrt(s);
        m[i] = tf * a * d[i]; m[i + 1] = tf * b * d[i];
      }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] > x) hi = mid; else lo = mid; }
      var h = xs[lo + 1] - xs[lo], t = (x - xs[lo]) / h;
      var t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] +
             (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * h * m[lo + 1];
    };
  }

  function bump(x, c, w) { var t = (x - c) / Math.max(w, 0.02); return Math.exp(-t * t * 2.2); }

  /* 매개변수 커브(그림자/어둡게/밝게/하이라이트)의 보정량 */
  function parametricDelta(pm, x) {
    var s1 = pm.splitSh / 100, s2 = pm.splitMid / 100, s3 = pm.splitHi / 100;
    var d = 0;
    d += (pm.sh / 100)     * bump(x, s1 * 0.5,          Math.max(s1 * 0.75, .08));
    d += (pm.darks / 100)  * bump(x, (s1 + s2) / 2,     Math.max((s2 - s1) * 0.75, .08));
    d += (pm.lights / 100) * bump(x, (s2 + s3) / 2,     Math.max((s3 - s2) * 0.75, .08));
    d += (pm.hi / 100)     * bump(x, (s3 + 1) / 2,      Math.max((1 - s3) * 0.75, .08));
    return d * 0.26;
  }

  function buildCurveLUT(preset) {
    var out = new Uint8Array(256 * 4);
    var cv = preset.curve;
    var fM = monotoneSpline(cv.rgb), fR = monotoneSpline(cv.r),
        fG = monotoneSpline(cv.g),   fB = monotoneSpline(cv.b);
    var pm = cv.param;
    for (var i = 0; i < 256; i++) {
      var x = i / 255;
      var m = fM(i) / 255 + parametricDelta(pm, x);
      out[i * 4]     = Math.max(0, Math.min(255, Math.round(m * 255)));
      out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(fR(i))));
      out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(fG(i))));
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(fB(i))));
    }
    return out;
  }

  function isIdentityCurve(preset) {
    var cv = preset.curve, pm = cv.param;
    if (pm.hi || pm.lights || pm.darks || pm.sh) return false;
    var keys = ['rgb', 'r', 'g', 'b'];
    for (var k = 0; k < 4; k++) {
      var p = cv[keys[k]];
      if (p.length !== 2) return false;
      if (p[0][0] !== 0 || p[0][1] !== 0 || p[1][0] !== 255 || p[1][1] !== 255) return false;
    }
    return true;
  }

  /* HSV(색상각, 채도%) → 휘도 제거된 색 오프셋 */
  function gradeOffset(zone, gain) {
    var h = ((zone.h % 360) + 360) % 360 / 360;
    var s = zone.s / 100;
    if (s === 0) return [0, 0, 0];
    var rgb = hsv2rgbJS(h, 1, 1);
    var lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return [(rgb[0] - lum) * s * gain, (rgb[1] - lum) * s * gain, (rgb[2] - lum) * s * gain];
  }
  function hsv2rgbJS(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t];
      case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q];
    }
  }

  /* ══════════════ 렌더러 ══════════════ */

  /* 자동 화이트밸런스 채널 게인 — 모든 렌더러(미리보기·촬영)가 함께 씁니다.
     1,1,1 이면 보정하지 않은 것과 같습니다. */
  var awbGain = [1, 1, 1];

  function GLRenderer(canvas) {
    this.canvas = canvas;
    this.ok = false;
    this.preset = XMP.neutral();
    this.amount = 1;
    this.time = 0;
    this._init();
  }

  GLRenderer.prototype._init = function () {
    var opts = { alpha: false, antialias: false, depth: false, stencil: false,
                 premultipliedAlpha: false, preserveDrawingBuffer: true,
                 powerPreference: 'high-performance' };
    var gl = this.canvas.getContext('webgl', opts) ||
             this.canvas.getContext('experimental-webgl', opts);
    if (!gl) { this.error = 'WebGL 을 사용할 수 없습니다'; return; }
    this.gl = gl;

    var prog = this._program(VERT, FRAG);
    if (!prog) return;
    this.prog = prog;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    /* 유니폼 위치 캐시 */
    var names = ['uTex', 'uCurve', 'uTexel', 'uAmount', 'uTime', 'uHasCurve', 'uHasLocal',
      'uLetterbox', 'uMono', 'uAWB', 'uWB', 'uTone', 'uLocal', 'uSatV', 'uGSh', 'uGMid',
      'uGHi', 'uGGl', 'uGLum', 'uGMix', 'uVig', 'uGrainP', 'uFadeSh', 'uScale', 'uOffset',
      'uFlipX'];
    this.u = {};
    for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(prog, names[i]);
    this.uHSL = gl.getUniformLocation(prog, 'uHSL[0]');
    this.uBandC = gl.getUniformLocation(prog, 'uBandC[0]');
    this.uBandW = gl.getUniformLocation(prog, 'uBandW[0]');

    /* 소스 텍스처 */
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    /* 커브 LUT 텍스처 */
    this.curveTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.uniform1i(this.u.uTex, 0);
    gl.uniform1i(this.u.uCurve, 1);
    gl.uniform1fv(this.uBandC, new Float32Array(BAND_C));
    gl.uniform1fv(this.uBandW, new Float32Array(BAND_W));

    this.ok = true;
    this.setPreset(this.preset, 1);
  };

  GLRenderer.prototype._program = function (vs, fs) {
    var gl = this.gl;
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('셰이더 오류:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { this.error = '셰이더 컴파일 실패'; return null; }
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      this.error = gl.getProgramInfoLog(p);
      console.error('링크 오류:', this.error);
      return null;
    }
    return p;
  };

  /* 프리셋 → 유니폼 */
  GLRenderer.prototype.setPreset = function (preset, amount) {
    if (!this.ok) return;
    var gl = this.gl, u = this.u;
    var p = this.preset = XMP.normalize(preset || XMP.neutral());
    this.amount = amount === undefined ? this.amount : amount;

    gl.useProgram(this.prog);
    var b = p.basic, g = p.grade, f = p.fx;

    gl.uniform3f(u.uAWB, awbGain[0], awbGain[1], awbGain[2]);
    gl.uniform4f(u.uWB, b.temp / 100, b.tint / 100, b.exposure, b.contrast / 100);
    gl.uniform4f(u.uTone, b.highlights / 100, b.shadows / 100, b.whites / 100, b.blacks / 100);
    gl.uniform3f(u.uLocal, b.texture / 100, b.clarity / 100, b.dehaze / 100);
    gl.uniform2f(u.uSatV, b.vibrance / 100, b.saturation / 100);

    var hsl = new Float32Array(24);
    for (var i = 0; i < 8; i++) {
      hsl[i * 3]     = p.hsl.hue[i] / 100;
      hsl[i * 3 + 1] = p.hsl.sat[i] / 100;
      hsl[i * 3 + 2] = p.hsl.lum[i] / 100;
    }
    gl.uniform3fv(this.uHSL, hsl);

    var gs = gradeOffset(g.shadow, 0.5), gm = gradeOffset(g.mid, 0.5),
        gh = gradeOffset(g.high, 0.5),   gg = gradeOffset(g.global, 0.35);
    gl.uniform3f(u.uGSh, gs[0], gs[1], gs[2]);
    gl.uniform3f(u.uGMid, gm[0], gm[1], gm[2]);
    gl.uniform3f(u.uGHi, gh[0], gh[1], gh[2]);
    gl.uniform3f(u.uGGl, gg[0], gg[1], gg[2]);
    gl.uniform4f(u.uGLum, g.shadow.l / 100, g.mid.l / 100, g.high.l / 100, g.global.l / 100);
    gl.uniform2f(u.uGMix, g.balance / 100, g.blending / 100);

    gl.uniform3f(u.uVig, f.vignette / 100, 1 - f.vignetteMid / 100, f.vignetteFeather / 100);
    gl.uniform2f(u.uGrainP, f.grain / 100, 0.7 + f.grainSize / 100 * 2.6);
    gl.uniform2f(u.uFadeSh, f.fade / 100, f.sharpen / 100);
    gl.uniform1f(u.uMono, f.monochrome ? 1 : 0);

    var hasLocal = !!(b.texture || b.clarity || b.dehaze || f.sharpen);
    gl.uniform1f(u.uHasLocal, hasLocal ? 1 : 0);

    var identity = isIdentityCurve(p);
    gl.uniform1f(u.uHasCurve, identity ? 0 : 1);
    if (!identity) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildCurveLUT(p));
    }
    gl.uniform1f(u.uAmount, this.amount);
  };

  /* 프리셋을 다시 세팅하지 않고 게인만 밀어넣습니다 (매 프레임 호출해도 쌉니다) */
  GLRenderer.prototype.applyAWB = function () {
    if (!this.ok) return;
    this.gl.useProgram(this.prog);
    this.gl.uniform3f(this.u.uAWB, awbGain[0], awbGain[1], awbGain[2]);
  };

  GLRenderer.prototype.setAmount = function (a) {
    if (!this.ok) return;
    this.amount = a;
    this.gl.useProgram(this.prog);
    this.gl.uniform1f(this.u.uAmount, a);
  };

  GLRenderer.prototype.setSize = function (w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w; this.canvas.height = h;
  };

  /* 소스(video/canvas/image)를 그린다 */
  GLRenderer.prototype.draw = function (src, opts) {
    if (!this.ok) return false;
    opts = opts || {};
    var gl = this.gl;
    var sw = src.videoWidth || src.naturalWidth || src.width;
    var sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) return false;

    var cw = this.canvas.width, ch = this.canvas.height;
    gl.useProgram(this.prog);
    gl.viewport(0, 0, cw, ch);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch (e) { return false; }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);

    /* object-fit: cover(기본) · contain(opts.contain)
       uScale 은 "화면 좌표 → 텍스처 좌표" 배율입니다.
         1 보다 작으면 텍스처의 일부만 훑어 잘라내고(cover),
         1 보다 크면 텍스처 바깥까지 훑어 여백이 생깁니다(contain). */
    var srcAspect = sw / sh, dstAspect = cw / ch;
    var wide = srcAspect > dstAspect;      /* 사진이 화면보다 옆으로 넓다 */
    var sx = 1, sy = 1;
    if (opts.contain) {
      if (wide) sy = srcAspect / dstAspect;   /* 위아래에 여백 */
      else      sx = dstAspect / srcAspect;   /* 좌우에 여백 */
    } else {
      if (wide) sx = dstAspect / srcAspect;   /* 좌우를 잘라냄 */
      else      sy = srcAspect / dstAspect;   /* 위아래를 잘라냄 */
    }
    gl.uniform1f(this.u.uLetterbox, opts.contain ? 1 : 0);
    gl.uniform2f(this.u.uScale, sx, sy);
    gl.uniform2f(this.u.uOffset, 0, 0);
    gl.uniform1f(this.u.uFlipX, opts.mirror ? 1 : 0);
    gl.uniform2f(this.u.uTexel, 1 / sw, 1 / sh);

    this.time = opts.freezeGrain ? 0.5 : (this.time + 0.37) % 1000;
    gl.uniform1f(this.u.uTime, this.time);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };

  GLRenderer.prototype.dispose = function () {
    if (!this.gl) return;
    var ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    this.ok = false;
  };

  /* ── 오프스크린 렌더러 (촬영 · 썸네일 전용) ── */
  var offscreen = null;
  function getOffscreen() {
    if (!offscreen || !offscreen.ok) {
      var cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      offscreen = new GLRenderer(cv);
    }
    return offscreen;
  }

  /* 소스를 프리셋 적용해 캔버스로 렌더 (촬영/썸네일)
     contain 을 주면 잘라내는 대신 사진 전체를 넣고 남는 자리를 검게 둡니다 */
  function renderTo(src, preset, amount, w, h, mirror, contain) {
    var r = getOffscreen();
    if (!r.ok) return null;
    r.setSize(w, h);
    r.setPreset(preset, amount);
    if (!r.draw(src, { mirror: mirror, freezeGrain: true, contain: !!contain })) return null;
    return r.canvas;
  }

  /* 자동 화이트밸런스 게인 설정 — 촬영용 오프스크린에도 같이 적용됩니다 */
  function setAWB(r, g, b) {
    awbGain[0] = r; awbGain[1] = g; awbGain[2] = b;
    if (offscreen && offscreen.ok) offscreen.applyAWB();
  }
  function getAWB() { return awbGain.slice(); }

  global.GL = {
    Renderer: GLRenderer,
    renderTo: renderTo,
    setAWB: setAWB, getAWB: getAWB,
    buildCurveLUT: buildCurveLUT,
    monotoneSpline: monotoneSpline,
    parametricDelta: parametricDelta,
    BAND_C: BAND_C, BAND_W: BAND_W
  };
})(window);
