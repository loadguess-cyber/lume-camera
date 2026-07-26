/* ══════════════════════════════════════════════════════════
   analyze.js — 프레임 분석: 자동 화이트밸런스 · 히스토그램

   화면 전체를 읽으면 비싸므로 작은 캔버스(기본 64×48)로 줄여서 봅니다.
   AWB 는 보정 전 영상에서, 히스토그램은 보정 후 화면에서 뽑습니다.
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var SW = 64, SH = 48;
  var cv = null, ctx = null;

  function sampler() {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = SW; cv.height = SH;
      ctx = cv.getContext('2d', { willReadFrequently: true });
    }
    return ctx;
  }

  /* 소스(video/canvas)를 작게 그려 픽셀을 읽습니다. 실패하면 null */
  function sample(src) {
    var w = src.videoWidth || src.naturalWidth || src.width;
    var h = src.videoHeight || src.naturalHeight || src.height;
    if (!w || !h) return null;
    var c = sampler();
    try {
      c.drawImage(src, 0, 0, SW, SH);
      return c.getImageData(0, 0, SW, SH).data;
    } catch (e) {
      return null;   /* 오염된 캔버스 등 */
    }
  }

  /* ══════════════ 자동 화이트밸런스 ══════════════

     회색계 가정(gray world)에 잘라먹힌 화소 제외를 더한 방식입니다.
     너무 어둡거나(<16) 거의 흰색으로 날아간(>246) 화소는 색 정보가
     없으므로 빼고 평균을 냅니다. 그 평균이 무채색이 되도록 채널
     게인을 구합니다 — 노란기·파란기가 함께 사라집니다.

     한쪽 색이 화면을 덮은 장면(잔디밭, 노을)에서는 회색계 가정이
     깨지므로, 게인을 ±MAX_GAIN 안으로 묶어 과보정을 막습니다. */

  var MAX_GAIN = 1.8;         /* 채널당 최대 보정폭 */
  var MIN_PIXELS = 120;       /* 이보다 적게 남으면 판단을 보류 */

  /* 회색계 가정만 씁니다.
     밝은 쪽을 백색점으로 삼아 섞어보기도 했지만, 가장 밝은 곳이 흰색이
     아닌 장면(노을의 해 등)에서는 오히려 반대쪽으로 치우쳤습니다.
     "화면 평균이 무채색" 이라는 기준이 요구사항과 정확히 맞고 결과도
     예측 가능해서 이쪽을 씁니다. */
  function awbGains(px) {
    if (!px) return null;
    var sr = 0, sg = 0, sb = 0, n = 0;
    for (var i = 0; i < px.length; i += 4) {
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      if (mn < 16 || mx > 246) continue;
      sr += r; sg += g; sb += b; n++;
    }
    if (n < MIN_PIXELS) return null;

    /* 감마를 되돌려 선형 공간에서 평균을 봅니다 (게인도 선형에서 곱하므로) */
    var ar = linear(sr / n / 255), ag = linear(sg / n / 255), ab = linear(sb / n / 255);
    if (ar <= 0 || ag <= 0 || ab <= 0) return null;

    /* 초록을 기준으로 잡습니다 — 센서에서 가장 화소가 많아 노이즈가 적습니다 */
    return [
      clamp(ag / ar, 1 / MAX_GAIN, MAX_GAIN),
      1,
      clamp(ag / ab, 1 / MAX_GAIN, MAX_GAIN)
    ];
  }

  function linear(v) { return Math.pow(Math.max(v, 0), 2.2); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 급격히 튀지 않도록 이전 값과 섞습니다 (화면이 확 바뀔 때 색이 출렁이는 것 방지) */
  function smooth(prev, next, k) {
    if (!prev) return next.slice();
    if (!next) return prev;
    k = k === undefined ? 0.18 : k;
    return [
      prev[0] + (next[0] - prev[0]) * k,
      prev[1] + (next[1] - prev[1]) * k,
      prev[2] + (next[2] - prev[2]) * k
    ];
  }

  /* 게인을 사람이 읽을 수 있는 색온도 느낌으로 (표시용 근사) */
  function gainsToLabel(g) {
    if (!g) return '—';
    var warm = g[2] / g[0];        /* >1 이면 파랑을 올린 것 = 원본이 노랬다 */
    if (warm > 1.06) return '따뜻한 광원 보정';
    if (warm < 0.94) return '푸른 광원 보정';
    return '중립';
  }

  /* ══════════════ 히스토그램 ══════════════ */

  function histogram(px) {
    if (!px) return null;
    var r = new Uint32Array(256), g = new Uint32Array(256),
        b = new Uint32Array(256), l = new Uint32Array(256);
    for (var i = 0; i < px.length; i += 4) {
      var R = px[i], G = px[i + 1], B = px[i + 2];
      r[R]++; g[G]++; b[B]++;
      l[(0.2126 * R + 0.7152 * G + 0.0722 * B) | 0]++;
    }
    return { r: r, g: g, b: b, l: l, total: px.length / 4 };
  }

  /* 히스토그램을 캔버스에 그립니다 (RGB 겹쳐 그리기) */
  function drawHistogram(canvas, hist) {
    var c = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    if (!hist) return;

    /* 최고점을 상위 채널 기준으로 잡되, 한 계급이 튀는 것은 무시 */
    var peak = 1;
    for (var i = 1; i < 255; i++) {
      peak = Math.max(peak, hist.r[i], hist.g[i], hist.b[i]);
    }

    /* 4분할 안내선 */
    c.strokeStyle = 'rgba(255,246,235,.10)';
    c.lineWidth = 1;
    for (var q = 1; q < 4; q++) {
      var x = Math.round(w * q / 4) + 0.5;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
    }

    var chans = [
      { d: hist.r, s: 'rgba(255,86,72,.72)' },
      { d: hist.g, s: 'rgba(96,224,128,.72)' },
      { d: hist.b, s: 'rgba(90,150,255,.72)' }
    ];
    c.globalCompositeOperation = 'lighter';
    for (var k = 0; k < chans.length; k++) {
      var d = chans[k].d;
      c.fillStyle = chans[k].s;
      c.beginPath();
      c.moveTo(0, h);
      for (var v = 0; v < 256; v++) {
        var y = h - Math.min(1, d[v] / peak) * h;
        c.lineTo(v / 255 * w, y);
      }
      c.lineTo(w, h);
      c.closePath();
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  /* 노출 경고 — 날아간/뭉갠 화소 비율 */
  function clipping(hist) {
    if (!hist) return null;
    var t = hist.total || 1;
    var hi = (hist.r[255] + hist.g[255] + hist.b[255]) / 3 / t;
    var lo = (hist.r[0] + hist.g[0] + hist.b[0]) / 3 / t;
    return { high: hi, low: lo };
  }

  global.Analyze = {
    sample: sample,
    awbGains: awbGains,
    smooth: smooth,
    gainsToLabel: gainsToLabel,
    histogram: histogram,
    drawHistogram: drawHistogram,
    clipping: clipping,
    SW: SW, SH: SH
  };
})(window);
