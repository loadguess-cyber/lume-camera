/* ══════════════════════════════════════════════════════════
   sample.js — 프리셋 확인용 샘플 장면 (2D 캔버스로 직접 그림)
   사진이 없어도 프리셋의 성격을 볼 수 있게, 하늘·역광·물·실루엣과
   컬러차트(피부톤·초록·하늘색 …)·회색 계조를 한 장에 담습니다.
   www/try.html 과 scripts/render-presets.js 가 함께 씁니다.
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var PATCHES = [
    '#E0AC91', '#8D5524', '#3F7A2E', '#4A7EBB', '#C0392B', '#E67E22',
    '#E8C547', '#27AE60', '#1ABC9C', '#2E5FA3', '#7D5BA6', '#C2478E'
  ];

  /* 캔버스에 샘플 장면을 그리고 그 캔버스를 돌려줍니다 */
  function draw(canvas, w, h) {
    w = w || 1280; h = h || 960;
    canvas.width = w; canvas.height = h;
    var c = canvas.getContext('2d');

    var sceneH = Math.round(h * 0.8);
    var horizon = Math.round(sceneH * 0.56);
    var sunX = w * 0.66, sunY = horizon - sceneH * 0.16;

    /* ── 하늘 ── */
    var sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0.00, '#14243F');
    sky.addColorStop(0.35, '#4B3C63');
    sky.addColorStop(0.68, '#B5623F');
    sky.addColorStop(0.90, '#E8964A');
    sky.addColorStop(1.00, '#F7CE7B');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, horizon);

    /* ── 태양과 빛무리 ── */
    var glow = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, sceneH * 0.52);
    glow.addColorStop(0.00, 'rgba(255,246,214,0.95)');
    glow.addColorStop(0.06, 'rgba(255,224,150,0.75)');
    glow.addColorStop(0.30, 'rgba(255,170,90,0.28)');
    glow.addColorStop(1.00, 'rgba(255,140,60,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, horizon);

    c.fillStyle = '#FFF8DC';
    c.beginPath();
    c.arc(sunX, sunY, sceneH * 0.055, 0, Math.PI * 2);
    c.fill();

    /* ── 구름 ── */
    c.save();
    var clouds = [
      [0.18, 0.20, 0.20, 0.030, 0.30], [0.30, 0.26, 0.14, 0.022, 0.24],
      [0.78, 0.15, 0.17, 0.026, 0.22], [0.50, 0.34, 0.24, 0.020, 0.18],
      [0.10, 0.40, 0.16, 0.016, 0.16]
    ];
    for (var i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      c.fillStyle = 'rgba(255,208,168,' + cl[4] + ')';
      c.beginPath();
      c.ellipse(w * cl[0], horizon * cl[1], w * cl[2], sceneH * cl[3], 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    /* ── 물 ── */
    var sea = c.createLinearGradient(0, horizon, 0, sceneH);
    sea.addColorStop(0.00, '#D08A4B');
    sea.addColorStop(0.22, '#8A5A50');
    sea.addColorStop(0.60, '#39445C');
    sea.addColorStop(1.00, '#1B2436');
    c.fillStyle = sea;
    c.fillRect(0, horizon, w, sceneH - horizon);

    /* 물 위 윤슬 — 아래로 갈수록 넓고 성기게 */
    for (var y = horizon + 2; y < sceneH; y += 5) {
      var t = (y - horizon) / (sceneH - horizon);
      var spread = w * (0.02 + t * 0.16);
      var n = 3 + Math.round(t * 7);
      for (var k = 0; k < n; k++) {
        var rx = (pseudo(y * 7 + k * 13) - 0.5) * 2 * spread;
        var len = (2 + pseudo(y * 3 + k) * 16) * (0.4 + t);
        c.fillStyle = 'rgba(255,214,150,' + (0.30 * (1 - t * 0.7)).toFixed(3) + ')';
        c.fillRect(sunX + rx - len / 2, y, len, 2);
      }
    }

    /* ── 원경 능선 ── */
    c.fillStyle = '#2B2436';
    c.beginPath();
    c.moveTo(0, horizon);
    c.lineTo(0, horizon - sceneH * 0.05);
    c.quadraticCurveTo(w * 0.14, horizon - sceneH * 0.13, w * 0.28, horizon - sceneH * 0.03);
    c.quadraticCurveTo(w * 0.36, horizon - sceneH * 0.09, w * 0.46, horizon);
    c.closePath();
    c.fill();

    /* ── 근경 실루엣 ── */
    c.fillStyle = '#0E1118';
    c.beginPath();
    c.moveTo(0, sceneH);
    c.lineTo(0, sceneH * 0.86);
    c.quadraticCurveTo(w * 0.16, sceneH * 0.78, w * 0.30, sceneH * 0.90);
    c.quadraticCurveTo(w * 0.42, sceneH * 0.99, w * 0.55, sceneH * 0.93);
    c.lineTo(w, sceneH * 0.97);
    c.lineTo(w, sceneH);
    c.closePath();
    c.fill();

    /* 갈대 몇 줄기 */
    c.strokeStyle = '#0B0E14';
    c.lineWidth = Math.max(2, w * 0.0025);
    for (var g = 0; g < 9; g++) {
      var gx = w * (0.62 + g * 0.042);
      var gh = sceneH * (0.10 + pseudo(g * 31) * 0.10);
      c.beginPath();
      c.moveTo(gx, sceneH);
      c.quadraticCurveTo(gx + w * 0.012, sceneH - gh * 0.6, gx + w * 0.03, sceneH - gh);
      c.stroke();
    }

    /* ── 컬러차트 ── */
    var chartY = sceneH, chartH = h - sceneH;
    c.fillStyle = '#101215';
    c.fillRect(0, chartY, w, chartH);

    var pad = Math.round(w * 0.012);
    var patchH = Math.round(chartH * 0.58);
    var pw = (w - pad * (PATCHES.length + 1)) / PATCHES.length;
    for (var p = 0; p < PATCHES.length; p++) {
      c.fillStyle = PATCHES[p];
      c.fillRect(pad + p * (pw + pad), chartY + pad, pw, patchH - pad);
    }

    var rampY = chartY + patchH + pad * 0.5;
    var rampH = chartH - patchH - pad * 1.5;
    var ramp = c.createLinearGradient(pad, 0, w - pad, 0);
    ramp.addColorStop(0, '#000000');
    ramp.addColorStop(1, '#FFFFFF');
    c.fillStyle = ramp;
    c.fillRect(pad, rampY, w - pad * 2, rampH);

    return canvas;
  }

  /* 씨앗 없는 결정적 난수 — 렌더할 때마다 같은 그림이 나오게 */
  function pseudo(n) {
    var x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  global.SAMPLE = { draw: draw, patches: PATCHES };
})(typeof window !== 'undefined' ? window : this);
