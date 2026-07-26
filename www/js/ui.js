/* ══════════════════════════════════════════════════════════
   ui.js — 화면 · 프리셋 캐러셀 · 편집기 · 보관함 · 설정
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* 슬라이더 트랙을 기본값 기준으로 채웁니다.
     ±슬라이더는 가운데(0)에서 손잡이 쪽으로만 색이 차고, 가운데에 기준 눈금이 섭니다.
     CSS 가 --lo/--hi 로 트랙 그라디언트를 그립니다. */
  function paintRange(inp) {
    if (!inp || inp.type !== 'range') return;
    var min = +inp.min || 0, max = +inp.max, v = +inp.value;
    if (!isFinite(max) || max === min) max = min + 100;
    var span = max - min;
    var p = (v - min) / span * 100;
    var z = min < 0 ? (0 - min) / span * 100 : 0;
    inp.style.setProperty('--lo', Math.min(p, z) + '%');
    inp.style.setProperty('--hi', Math.max(p, z) + '%');
    inp.classList.toggle('bi', min < 0);
  }

  /* 사용자가 끄는 동안은 이 하나로 전부 처리됩니다 */
  document.addEventListener('input', function (e) {
    if (e.target && e.target.type === 'range') paintRange(e.target);
  }, true);

  /* ══════════════ 상태 ══════════════ */
  var S = {
    presets: [],        // 내장 + 사용자
    currentId: null,    // null = 원본
    amount: 1,
    mode: 'photo',
    ratio: '3:4',
    grid: false,
    torch: false,
    editing: null,      // 편집 중 사본
    editBase: null,     // 편집 시작 시점 스냅샷
    curveCh: 'rgb',
    hslMode: 'hue',
    gradeZone: 'mid',
    libTab: 'mine',
    lastShot: null      // {url,type,blob,name}
  };

  /* 편집기를 아직 열지 않았을 때 슬라이더가 읽을 빈 프리셋 */
  var EDIT_FALLBACK = null;
  function editObj() {
    if (!S.editing) {
      if (!EDIT_FALLBACK) EDIT_FALLBACK = XMP.neutral();
      return EDIT_FALLBACK;
    }
    return S.editing;
  }

  function allPresets() { return S.presets; }
  function findPreset(id) {
    for (var i = 0; i < S.presets.length; i++) if (S.presets[i].id === id) return S.presets[i];
    return null;
  }
  function currentPreset() {
    return S.currentId ? findPreset(S.currentId) : null;
  }
  function activePreset() {
    return S.editing || currentPreset() || XMP.neutral();
  }
  function activeAmount() {
    return S.editing ? 1 : (S.currentId ? S.amount : 0);
  }

  function applyToRenderer() {
    var r = Cam.getRenderer();
    if (!r || !r.ok) return;
    r.setPreset(activePreset(), activeAmount());
  }

  function userPresets() {
    return S.presets.filter(function (p) { return p.source !== 'builtin'; });
  }
  function persist() {
    Store.savePresets(userPresets());
    Store.saveState({ currentId: S.currentId, amount: S.amount, mode: S.mode });
  }

  /* ══════════════ 공용 다이얼로그 ══════════════ */
  function askText(title, value, placeholder) {
    return new Promise(function (resolve) {
      var ov = el('div', 'modal-ov');
      ov.innerHTML =
        '<div class="modal">' +
        '<div class="modal-t"></div>' +
        '<input class="modal-in" type="text">' +
        '<div class="modal-btns">' +
        '<button class="btn-ghost" data-x="c">취소</button>' +
        '<button class="btn-ghost accent" data-x="o">확인</button>' +
        '</div></div>';
      $('.modal-t', ov).textContent = title;
      var input = $('.modal-in', ov);
      input.value = value || '';
      input.placeholder = placeholder || '';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('on'); input.focus(); input.select(); });
      function close(v) { ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 200); resolve(v); }
      ov.addEventListener('click', function (e) {
        if (e.target === ov) close(null);
        var x = e.target.getAttribute && e.target.getAttribute('data-x');
        if (x === 'c') close(null);
        if (x === 'o') close(input.value.trim() || null);
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') close(input.value.trim() || null); });
    });
  }

  function askConfirm(title, okLabel, danger) {
    return new Promise(function (resolve) {
      var ov = el('div', 'modal-ov');
      ov.innerHTML =
        '<div class="modal"><div class="modal-t"></div><div class="modal-btns">' +
        '<button class="btn-ghost" data-x="c">취소</button>' +
        '<button class="btn-ghost ' + (danger ? 'danger' : 'accent') + '" data-x="o"></button>' +
        '</div></div>';
      $('.modal-t', ov).textContent = title;
      $('[data-x="o"]', ov).textContent = okLabel || '확인';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('on'); });
      function close(v) { ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 200); resolve(v); }
      ov.addEventListener('click', function (e) {
        if (e.target === ov) close(false);
        var x = e.target.getAttribute && e.target.getAttribute('data-x');
        if (x === 'c') close(false);
        if (x === 'o') close(true);
      });
    });
  }

  function actionSheet(title, items) {
    return new Promise(function (resolve) {
      var ov = el('div', 'modal-ov sheet-ov');
      var box = el('div', 'asheet');
      box.appendChild(el('div', 'asheet-t', title));
      items.forEach(function (it) {
        var b = el('button', 'asheet-i' + (it.danger ? ' danger' : ''), it.label);
        b.addEventListener('click', function () { close(it.id); });
        box.appendChild(b);
      });
      var cancel = el('button', 'asheet-i cancel', '취소');
      cancel.addEventListener('click', function () { close(null); });
      box.appendChild(cancel);
      ov.appendChild(box);
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('on'); });
      function close(v) { ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 220); resolve(v); }
      ov.addEventListener('click', function (e) { if (e.target === ov) close(null); });
    });
  }

  /* ══════════════ 화면 전환 ══════════════ */
  function openSheet(id) {
    var s = document.getElementById(id);
    if (s) s.classList.add('active');
  }
  function closeSheet(id) {
    var s = document.getElementById(id);
    if (s) s.classList.remove('active');
  }
  function anySheetOpen() {
    return $$('.screen.sheet.active').length > 0 || $('#screen-viewer').classList.contains('active');
  }

  /* ══════════════ 프리셋 캐러셀 ══════════════ */
  var railCanvases = [];

  function buildRail() {
    var rail = $('#presetRail');
    rail.innerHTML = '';
    railCanvases = [];

    var list = [{ id: null, name: '원본' }].concat(S.presets);
    list.forEach(function (p) {
      var card = el('div', 'pcard' + (p.id === S.currentId ? ' on' : ''));
      card.dataset.id = p.id || '';
      var chip = el('div', 'pchip');
      if (p.id) {
        var cv = el('canvas');
        cv.width = 96; cv.height = 96;
        chip.appendChild(cv);
        railCanvases.push({ cv: cv, preset: p });
      } else {
        chip.appendChild(el('div', 'none', '◎'));
      }
      card.appendChild(chip);
      card.appendChild(el('div', 'pname', p.name));
      card.addEventListener('click', function () {
        selectPreset(p.id);
        card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
      rail.appendChild(card);
    });
    refreshThumbs();
  }

  function selectPreset(id) {
    S.currentId = id;
    Store.haptic(8);
    $$('#presetRail .pcard').forEach(function (c) {
      c.classList.toggle('on', (c.dataset.id || null) === (id || null));
    });
    $('#intensityWrap').classList.toggle('hidden', !id || !Store.getSettings().showPresets);
    applyToRenderer();
    persist();
  }

  /* 미리보기 프레임으로 칩 썸네일 갱신 */
  function refreshThumbs() {
    var v = $('#video');
    if (!v || v.readyState < 2) return;
    var mirror = Cam.isMirrored();
    railCanvases.forEach(function (rc) {
      var out = GL.renderTo(v, rc.preset, 1, 96, 96, mirror);
      if (!out) return;
      var ctx = rc.cv.getContext('2d');
      ctx.drawImage(out, 0, 0, 96, 96);
    });
    if (S.libTab === 'mine' && $('#screen-library').classList.contains('active')) refreshLibThumbs();
  }

  var libCanvases = [];
  function refreshLibThumbs() {
    var v = $('#video');
    if (!v || v.readyState < 2) return;
    var mirror = Cam.isMirrored();
    libCanvases.forEach(function (rc) {
      var out = GL.renderTo(v, rc.preset, 1, 160, 160, mirror);
      if (!out) return;
      rc.cv.getContext('2d').drawImage(out, 0, 0, 160, 160);
    });
  }

  /* ══════════════ 슬라이더 만들기 ══════════════ */
  function sliderRow(def, get, set) {
    var row = el('div', 'row' + (def.wb ? ' wb' : ''));
    var top = el('div', 'row-top');
    var name = el('span', 'row-name', def.name);
    var val = el('span', 'row-val');
    top.appendChild(name); top.appendChild(val);
    var input = document.createElement('input');
    input.type = 'range';
    input.min = def.min; input.max = def.max;
    input.step = def.step || 1;
    row.appendChild(top); row.appendChild(input);

    function fmt(v) {
      if (def.fmt) return def.fmt(v);
      var n = def.step && def.step < 1 ? v.toFixed(2) : Math.round(v);
      return (n > 0 && def.signed !== false ? '+' : '') + n;
    }
    function sync() {
      var v = +get();
      input.value = v;
      val.textContent = fmt(v);
      val.classList.toggle('mod', Math.abs(v - (def.dflt || 0)) > 1e-6);
      paintRange(input);
    }
    input.addEventListener('input', function () {
      set(+input.value);
      val.textContent = fmt(+input.value);
      val.classList.toggle('mod', Math.abs(+input.value - (def.dflt || 0)) > 1e-6);
      onEdit();
    });
    /* 이름/값을 탭하면 기본값 복귀 */
    top.addEventListener('click', function () {
      set(def.dflt || 0); sync(); onEdit(); Store.haptic(12);
    });
    row.sync = sync;
    sync();
    return row;
  }

  function group(title) {
    return el('div', 'sec-title', title);
  }

  var BASIC_DEFS = [
    { g: '화이트 밸런스' },
    { k: 'temp', name: '색온도', min: -100, max: 100, wb: true },
    { k: 'tint', name: '색조', min: -100, max: 100, wb: true },
    { g: '톤' },
    { k: 'exposure', name: '노출', min: -5, max: 5, step: 0.05 },
    { k: 'contrast', name: '대비', min: -100, max: 100 },
    { k: 'highlights', name: '밝은 영역', min: -100, max: 100 },
    { k: 'shadows', name: '어두운 영역', min: -100, max: 100 },
    { k: 'whites', name: '흰색 계열', min: -100, max: 100 },
    { k: 'blacks', name: '검정 계열', min: -100, max: 100 },
    { g: '외관' },
    { k: 'texture', name: '텍스처', min: -100, max: 100 },
    { k: 'clarity', name: '부분 대비', min: -100, max: 100 },
    { k: 'dehaze', name: '안개 현상 제거', min: -100, max: 100 },
    { g: '색상' },
    { k: 'vibrance', name: '생동감', min: -100, max: 100 },
    { k: 'saturation', name: '채도', min: -100, max: 100 }
  ];

  var FX_DEFS = [
    { g: '비네팅' },
    { k: 'vignette', name: '양', min: -100, max: 100 },
    { k: 'vignetteMid', name: '중간점', min: 0, max: 100, dflt: 50 },
    { k: 'vignetteFeather', name: '페더', min: 0, max: 100, dflt: 50 },
    { g: '입자 (그레인)' },
    { k: 'grain', name: '양', min: 0, max: 100 },
    { k: 'grainSize', name: '크기', min: 0, max: 100, dflt: 25 },
    { k: 'grainRough', name: '거칠기', min: 0, max: 100, dflt: 50 },
    { g: '마무리' },
    { k: 'fade', name: '페이드 (매트)', min: 0, max: 100 },
    { k: 'sharpen', name: '선명도', min: 0, max: 100 }
  ];

  var CURVE_PARAM_DEFS = [
    { g: '매개변수 커브' },
    { k: 'hi', name: '밝은 영역', min: -100, max: 100 },
    { k: 'lights', name: '밝게', min: -100, max: 100 },
    { k: 'darks', name: '어둡게', min: -100, max: 100 },
    { k: 'sh', name: '어두운 영역', min: -100, max: 100 }
  ];

  function buildPane(container, defs, objGetter) {
    container.innerHTML = '';
    var rows = [];
    defs.forEach(function (d) {
      if (d.g) { container.appendChild(group(d.g)); return; }
      var row = sliderRow(d,
        function () { return objGetter()[d.k]; },
        function (v) { objGetter()[d.k] = v; liveUpdate(); });
      rows.push(row);
      container.appendChild(row);
    });
    container.syncAll = function () { rows.forEach(function (r) { r.sync(); }); };
    return container;
  }

  /* ══════════════ 편집기 ══════════════ */
  var basicPane, fxPane, curveParamPane;

  function initEditor() {
    basicPane = buildPane($('[data-pane="basic"]'), BASIC_DEFS, function () { return editObj().basic; });
    fxPane = buildPane($('[data-pane="fx"]'), FX_DEFS, function () { return editObj().fx; });

    /* 흑백 토글 */
    var mono = el('div', 'set-item');
    mono.innerHTML = '<div class="set-label"><b>흑백</b><span>색을 모두 빼고 톤만 남깁니다</span></div>';
    var sw = el('div', 'switch');
    mono.appendChild(sw);
    sw.addEventListener('click', function () {
      editObj().fx.monochrome = !editObj().fx.monochrome;
      sw.classList.toggle('on', editObj().fx.monochrome);
      liveUpdate(); onEdit();
    });
    fxPane.appendChild(mono);
    fxPane.monoSwitch = sw;

    curveParamPane = buildPane($('[data-group="param"]'), CURVE_PARAM_DEFS,
      function () { return editObj().curve.param; });

    /* 탭 */
    $$('#edTabs .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('#edTabs .tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        $$('#edBody .tabpane').forEach(function (p) {
          p.classList.toggle('active', p.dataset.pane === t.dataset.tab);
        });
        if (t.dataset.tab === 'curve') drawCurve();
        if (t.dataset.tab === 'grade') { drawWheel(); syncGrade(); }
        $('#edBody').scrollTop = 0;
      });
    });

    /* 커브 채널 */
    $$('.curve-chan .chan').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.curve-chan .chan').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        S.curveCh = b.dataset.ch;
        drawCurve();
      });
    });
    $('#curveReset').addEventListener('click', function () {
      S.editing.curve[S.curveCh] = [[0, 0], [255, 255]];
      drawCurve(); liveUpdate(); onEdit();
    });

    /* HSL 모드 */
    $$('.hsl-mode .chan').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.hsl-mode .chan').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        S.hslMode = b.dataset.hsl;
        buildHSL();
      });
    });

    /* 그레이딩 존 */
    $$('.grade-zones .chan').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.grade-zones .chan').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        S.gradeZone = b.dataset.zone;
        drawWheel(); syncGrade();
      });
    });

    buildGradeSliders();
    initCurveInput();
    initWheelInput();

    $('#edCancel').addEventListener('click', function () { closeEditor(false); });
    $('#edSave').addEventListener('click', function () { saveEditing(false); });
    $('#edSaveAs').addEventListener('click', function () { saveEditing(true); });
    $('#edReset').addEventListener('click', function () {
      askConfirm('모든 값을 초기화할까요?', '초기화', true).then(function (ok) {
        if (!ok) return;
        var name = S.editing.name, id = S.editing.id, src = S.editing.source;
        S.editing = XMP.neutral();
        S.editing.name = name; S.editing.id = id; S.editing.source = src;
        syncEditor(); liveUpdate(); onEdit();
      });
    });
    $('#edExport').addEventListener('click', function () { exportPreset(S.editing); });
  }

  function openEditor(preset) {
    var base = preset || currentPreset() || XMP.neutral();
    S.editing = XMP.normalize(JSON.parse(JSON.stringify(base)));
    if (!preset && !S.currentId) S.editing.name = '새 프리셋';
    S.editBase = JSON.stringify(S.editing);
    $('#edName').textContent = S.editing.name;
    $('#edDirty').classList.add('hidden');
    syncEditor();
    liveUpdate();
    openSheet('screen-editor');
  }

  function closeEditor(saved) {
    S.editing = null;
    S.editBase = null;
    closeSheet('screen-editor');
    applyToRenderer();
  }

  function onEdit() {
    if (!S.editing) return;
    var dirty = JSON.stringify(S.editing) !== S.editBase;
    $('#edDirty').classList.toggle('hidden', !dirty);
  }

  function liveUpdate() {
    var r = Cam.getRenderer();
    if (r && r.ok && S.editing) r.setPreset(S.editing, 1);
  }

  function syncEditor() {
    basicPane.syncAll();
    fxPane.syncAll();
    fxPane.monoSwitch.classList.toggle('on', !!S.editing.fx.monochrome);
    curveParamPane.syncAll();
    buildHSL();
    drawCurve();
    drawWheel();
    syncGrade();
  }

  function saveEditing(asNew) {
    var p = S.editing;
    if (!p) return;
    var doSave = function (name) {
      p.name = name;
      if (asNew || !p.id || p.source === 'builtin') {
        p = XMP.normalize(JSON.parse(JSON.stringify(p)));
        p.id = Store.uid();
        p.source = p.source === 'builtin' ? 'app' : (p.source || 'app');
        p.created = Date.now();
        S.presets.push(p);
      } else {
        for (var i = 0; i < S.presets.length; i++) {
          if (S.presets[i].id === p.id) { S.presets[i] = XMP.normalize(JSON.parse(JSON.stringify(p))); break; }
        }
      }
      S.currentId = p.id;
      S.amount = 1;
      $('#intensity').value = 100; $('#intensityVal').textContent = '100';
      paintRange($('#intensity'));
      persist();
      buildRail();
      buildLibrary();
      closeEditor(true);
      Store.toast('"' + p.name + '" 저장 완료');
      Store.haptic(18);
    };

    if (asNew || !p.id || p.source === 'builtin') {
      askText('프리셋 이름', p.source === 'builtin' ? p.name + ' 사본' : p.name).then(function (n) {
        if (n) doSave(n);
      });
    } else doSave(p.name);
  }

  function exportPreset(p) {
    var xml = XMP.serialize(p);
    var fn = XMP.safeFileName(p.name) + '.xmp';
    Store.saveText(xml, fn, { title: p.name + ' 프리셋', dialogTitle: 'XMP 프리셋 내보내기' })
      .then(function (res) {
        Store.toast(res.where === 'download' ? '파일을 내려받았습니다' : '문서/LUME 폴더에 저장했습니다');
      })
      .catch(function (e) { Store.toast('내보내기 실패: ' + (e.message || e)); });
  }

  /* ══════════════ 커브 편집 ══════════════ */
  var curveDrag = null, curveHoldTimer = 0;

  function curvePts() { return editObj().curve[S.curveCh]; }

  function drawCurve() {
    var cv = $('#curveCanvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    /* 격자 */
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1.5;
    for (var i = 1; i < 4; i++) {
      var t = i / 4 * W;
      ctx.beginPath(); ctx.moveTo(t, 0); ctx.lineTo(t, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, t); ctx.lineTo(W, t); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke();

    var pts = curvePts();
    var f = GL.monotoneSpline(pts);
    var color = { rgb: '#F2F3F5', r: '#FF8C82', g: '#8CE6A0', b: '#88B8FF' }[S.curveCh];

    /* 곡선 */
    ctx.strokeStyle = color; ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (var x = 0; x <= 255; x += 1) {
      var y = f(x);
      if (S.curveCh === 'rgb') y = y + GL.parametricDelta(editObj().curve.param, x / 255) * 255;
      y = Math.max(0, Math.min(255, y));
      var px = x / 255 * W, py = H - y / 255 * H;
      if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* 점 */
    for (var i2 = 0; i2 < pts.length; i2++) {
      var p = pts[i2];
      var cx = p[0] / 255 * W, cy = H - p[1] / 255 * H;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0C0F'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
    }
  }

  function initCurveInput() {
    var cv = $('#curveCanvas');
    function toData(e) {
      var r = cv.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * 255;
      var y = (1 - (e.clientY - r.top) / r.height) * 255;
      return [Store.clamp(x, 0, 255), Store.clamp(y, 0, 255)];
    }
    function nearest(pt) {
      var pts = curvePts(), best = -1, bd = 1e9;
      for (var i = 0; i < pts.length; i++) {
        var dx = pts[i][0] - pt[0], dy = pts[i][1] - pt[1];
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = i; }
      }
      return { i: best, d: bd };
    }

    cv.addEventListener('pointerdown', function (e) {
      if (!S.editing) return;
      cv.setPointerCapture(e.pointerId);
      var pt = toData(e);
      var n = nearest(pt);
      var pts = curvePts();
      if (n.d < 20) {
        curveDrag = n.i;
        clearTimeout(curveHoldTimer);
        if (n.i > 0 && n.i < pts.length - 1) {
          curveHoldTimer = setTimeout(function () {
            pts.splice(n.i, 1);
            curveDrag = null;
            drawCurve(); liveUpdate(); onEdit(); Store.haptic(22);
          }, 620);
        }
      } else if (pts.length < 16) {
        pts.push(pt);
        pts.sort(function (a, b) { return a[0] - b[0]; });
        curveDrag = pts.indexOf(pt);
        Store.haptic(10);
      }
      drawCurve(); liveUpdate(); onEdit();
      e.preventDefault();
    });

    cv.addEventListener('pointermove', function (e) {
      if (curveDrag === null || curveDrag === undefined) return;
      clearTimeout(curveHoldTimer);
      var pts = curvePts(), pt = toData(e);
      var i = curveDrag;
      var minX = i === 0 ? 0 : pts[i - 1][0] + 3;
      var maxX = i === pts.length - 1 ? 255 : pts[i + 1][0] - 3;
      if (i === 0) pt[0] = 0;
      else if (i === pts.length - 1) pt[0] = 255;
      else pt[0] = Store.clamp(pt[0], minX, maxX);
      pts[i] = [pt[0], pt[1]];
      drawCurve(); liveUpdate(); onEdit();
      e.preventDefault();
    });

    function up() { clearTimeout(curveHoldTimer); curveDrag = null; }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  /* ══════════════ HSL ══════════════ */
  function buildHSL() {
    var host = $('#hslBody');
    if (!host) return;
    host.innerHTML = '';
    var arr = editObj().hsl[S.hslMode];
    for (var i = 0; i < 8; i++) {
      (function (idx) {
        var row = el('div', 'hsl-row');
        var dot = el('span', 'hsl-dot');
        dot.style.background = 'hsl(' + XMP.HSL_HUES[idx] + ',85%,52%)';
        var nm = el('span', 'hsl-name', XMP.HSL_NAMES[idx]);
        var input = document.createElement('input');
        input.type = 'range'; input.min = -100; input.max = 100; input.step = 1;
        input.value = arr[idx];
        paintRange(input);
        var v = el('span', 'hsl-v', (arr[idx] > 0 ? '+' : '') + arr[idx]);
        input.addEventListener('input', function () {
          var val = +input.value;
          editObj().hsl[S.hslMode][idx] =val;
          v.textContent = (val > 0 ? '+' : '') + val;
          liveUpdate(); onEdit();
        });
        nm.addEventListener('click', function () {
          editObj().hsl[S.hslMode][idx] =0;
          input.value = 0; v.textContent = '0'; paintRange(input);
          liveUpdate(); onEdit(); Store.haptic(12);
        });
        row.appendChild(dot); row.appendChild(nm); row.appendChild(input); row.appendChild(v);
        host.appendChild(row);
      })(i);
    }
    var hint = el('div', 'curve-hint',
      S.hslMode === 'hue' ? '색조 — 각 색을 이웃 색 쪽으로 밀어냅니다' :
      S.hslMode === 'sat' ? '채도 — 특정 색만 진하게/옅게' :
                            '휘도 — 특정 색의 밝기');
    host.appendChild(hint);
  }

  /* ══════════════ 컬러 그레이딩 ══════════════ */
  var gradeRows = [];

  function zoneObj() { return editObj().grade[S.gradeZone]; }

  function buildGradeSliders() {
    var host = $('#gradeSliders');
    host.innerHTML = '';
    gradeRows = [];

    var lum = sliderRow({ k: 'l', name: '휘도', min: -100, max: 100 },
      function () { return zoneObj().l; },
      function (v) { zoneObj().l = v; liveUpdate(); });
    host.appendChild(lum); gradeRows.push(lum);

    var sat = sliderRow({ k: 's', name: '채도', min: 0, max: 100 },
      function () { return zoneObj().s; },
      function (v) { zoneObj().s = v; drawWheelDot(); liveUpdate(); });
    host.appendChild(sat); gradeRows.push(sat);

    var hue = sliderRow({ k: 'h', name: '색상', min: 0, max: 359, signed: false,
        fmt: function (v) { return Math.round(v) + '°'; } },
      function () { return zoneObj().h; },
      function (v) { zoneObj().h = v; drawWheelDot(); liveUpdate(); });
    host.appendChild(hue); gradeRows.push(hue);

    host.appendChild(group('혼합'));
    var bl = sliderRow({ k: 'blending', name: '혼합', min: 0, max: 100, dflt: 50 },
      function () { return editObj().grade.blending; },
      function (v) { editObj().grade.blending = v; liveUpdate(); });
    host.appendChild(bl); gradeRows.push(bl);

    var ba = sliderRow({ k: 'balance', name: '균형', min: -100, max: 100 },
      function () { return editObj().grade.balance; },
      function (v) { editObj().grade.balance = v; liveUpdate(); });
    host.appendChild(ba); gradeRows.push(ba);
  }

  function syncGrade() {
    gradeRows.forEach(function (r) { r.sync(); });
    drawWheelDot();
  }

  function drawWheel() {
    var cv = $('#wheel');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height, R = W / 2;
    var img = ctx.createImageData(W, H);
    var d = img.data;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var dx = x - R, dy = y - R;
        var r = Math.sqrt(dx * dx + dy * dy) / R;
        var i = (y * W + x) * 4;
        if (r > 1) { d[i + 3] = 0; continue; }
        var ang = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
        var rgb = hsvToRgb(ang / 360, Math.min(r, 1), 1);
        d[i] = rgb[0] * 255; d[i + 1] = rgb[1] * 255; d[i + 2] = rgb[2] * 255;
        d[i + 3] = 255 * Math.min(1, (1 - r) * 14 + 0.92);
      }
    }
    ctx.putImageData(img, 0, 0);
    drawWheelDot();
  }

  function drawWheelDot() {
    var dot = $('#wheelDot'), wrap = $('.wheel-wrap');
    if (!dot || !wrap) return;
    var z = zoneObj();
    var ang = (z.h - 90) * Math.PI / 180;
    var rad = Store.clamp(z.s / 100, 0, 1) * 0.5;
    dot.style.left = (50 + Math.cos(ang) * rad * 100) + '%';
    dot.style.top = (50 + Math.sin(ang) * rad * 100) + '%';
    dot.style.background = z.s > 0 ? hsvCss(z.h, z.s / 100) : 'transparent';
  }

  function hsvCss(h, s) {
    var rgb = hsvToRgb(((h % 360) + 360) % 360 / 360, s, 1);
    return 'rgb(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ')';
  }
  function hsvToRgb(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t];
      case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q];
    }
  }

  function initWheelInput() {
    var cv = $('#wheel');
    var dragging = false;
    function set(e) {
      var r = cv.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width * 2 - 1;
      var dy = (e.clientY - r.top) / r.height * 2 - 1;
      var rad = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      var ang = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
      var z = zoneObj();
      z.h = Math.round(ang);
      z.s = Math.round(rad * 100);
      drawWheelDot(); syncGradeValues(); liveUpdate(); onEdit();
    }
    cv.addEventListener('pointerdown', function (e) {
      if (!S.editing) return;
      dragging = true; cv.setPointerCapture(e.pointerId); set(e); e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) { if (dragging) { set(e); e.preventDefault(); } });
    cv.addEventListener('pointerup', function () { dragging = false; });
    cv.addEventListener('pointercancel', function () { dragging = false; });
  }
  function syncGradeValues() { gradeRows.forEach(function (r) { r.sync(); }); }

  /* ══════════════ 보관함 ══════════════ */
  function buildLibrary() {
    var grid = $('#libGrid');
    grid.innerHTML = '';
    libCanvases = [];

    S.presets.forEach(function (p) {
      var card = el('div', 'lcard' + (p.id === S.currentId ? ' on' : ''));
      var th = el('div', 'lcard-thumb');
      var cv = el('canvas'); cv.width = 160; cv.height = 160;
      th.appendChild(cv);
      libCanvases.push({ cv: cv, preset: p });
      if (p.source === 'builtin') th.appendChild(el('div', 'lcard-badge', '기본'));
      else if (p.source === 'xmp') th.appendChild(el('div', 'lcard-badge', 'XMP'));
      card.appendChild(th);
      var meta = el('div', 'lcard-meta');
      meta.appendChild(el('div', 'lcard-name', p.name));
      meta.appendChild(el('div', 'lcard-sub', p.author || '내 프리셋'));
      card.appendChild(meta);

      card.addEventListener('click', function () {
        selectPreset(p.id);
        buildLibrary();
        Store.toast('"' + p.name + '" 적용');
      });
      var hold = 0;
      card.addEventListener('pointerdown', function () {
        hold = setTimeout(function () { presetMenu(p); }, 520);
      });
      ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(function (ev) {
        card.addEventListener(ev, function () { clearTimeout(hold); });
      });
      grid.appendChild(card);
    });
    refreshLibThumbs();
  }

  function presetMenu(p) {
    Store.haptic(20);
    var items = [
      { id: 'apply', label: '적용하기' },
      { id: 'edit', label: '편집' },
      { id: 'dup', label: '복제' },
      { id: 'export', label: 'XMP 로 내보내기' }
    ];
    if (p.source !== 'builtin') {
      items.push({ id: 'rename', label: '이름 바꾸기' });
      items.push({ id: 'del', label: '삭제', danger: true });
    }
    actionSheet(p.name, items).then(function (x) {
      if (x === 'apply') { selectPreset(p.id); buildLibrary(); }
      else if (x === 'edit') { closeSheet('screen-library'); openEditor(p); }
      else if (x === 'dup') {
        var c = XMP.normalize(JSON.parse(JSON.stringify(p)));
        c.id = Store.uid(); c.name = p.name + ' 사본'; c.source = 'app'; c.created = Date.now();
        S.presets.push(c); persist(); buildRail(); buildLibrary();
        Store.toast('복제했습니다');
      } else if (x === 'export') exportPreset(p);
      else if (x === 'rename') {
        askText('새 이름', p.name).then(function (n) {
          if (!n) return;
          p.name = n; persist(); buildRail(); buildLibrary();
        });
      } else if (x === 'del') {
        askConfirm('"' + p.name + '" 을 삭제할까요?', '삭제', true).then(function (ok) {
          if (!ok) return;
          S.presets = S.presets.filter(function (q) { return q.id !== p.id; });
          if (S.currentId === p.id) selectPreset(null);
          persist(); buildRail(); buildLibrary();
          Store.toast('삭제했습니다');
        });
      }
    });
  }

  function importFiles(files) {
    var list = Array.prototype.slice.call(files);
    if (!list.length) return;
    var okCount = 0, failCount = 0, lastId = null;
    var jobs = list.map(function (f) {
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var name = f.name.replace(/\.xmp$/i, '');
            var p = XMP.parse(String(fr.result), name);
            p.id = Store.uid();
            p.created = Date.now();
            S.presets.push(p);
            lastId = p.id;
            okCount++;
          } catch (e) { failCount++; }
          resolve();
        };
        fr.onerror = function () { failCount++; resolve(); };
        fr.readAsText(f);
      });
    });
    Promise.all(jobs).then(function () {
      persist(); buildRail(); buildLibrary();
      if (okCount && lastId) selectPreset(lastId);
      Store.toast(okCount + '개 불러옴' + (failCount ? ' · ' + failCount + '개 실패' : ''));
      Store.haptic(20);
    });
  }

  /* 커뮤니티 (준비 중) — 실제 서버 연동 자리 */
  var SAMPLE_FEED = [
    { name: '서울 야경 팩', by: '@nightwalk', price: '₩4,900', c1: '#2B1B4A', c2: '#C94F7C' },
    { name: '제주 바다 5종', by: '@blueline', price: '₩3,900', c1: '#0E3B4C', c2: '#7FD3C6' },
    { name: '필름 감성 10종', by: '@grainlab', price: '₩7,900', c1: '#4A3520', c2: '#D9B27C' },
    { name: '카페 무드', by: '@warmtone', price: '무료', c1: '#3A2A22', c2: '#C79A6B' },
    { name: '웨딩 클린', by: '@studio_h', price: '₩9,900', c1: '#4A4740', c2: '#EFE6D8' }
  ];
  function buildStore() {
    var host = $('#storeBody');
    host.innerHTML = '';
    var hero = el('div', 'store-hero');
    hero.innerHTML =
      '<div class="soon-badge">준비 중</div>' +
      '<h3>프리셋 마켓</h3>' +
      '<p>내가 만든 색감을 올리고, 다른 사람의 프리셋을 받아보세요.<br>' +
      '판매 수익은 창작자에게 정산됩니다. 아래는 예시 화면입니다.</p>';
    host.appendChild(hero);
    var list = el('div', 'store-list');
    SAMPLE_FEED.forEach(function (s) {
      var it = el('div', 'store-item');
      var cover = el('div', 'store-cover');
      cover.style.background = 'linear-gradient(135deg,' + s.c1 + ',' + s.c2 + ')';
      var info = el('div', 'store-info');
      info.appendChild(el('div', 'store-name', s.name));
      info.appendChild(el('div', 'store-by', s.by));
      it.appendChild(cover); it.appendChild(info);
      it.appendChild(el('div', 'store-price', s.price));
      list.appendChild(it);
    });
    host.appendChild(list);

    var up = el('div', 'store-hero');
    up.innerHTML = '<p style="font-size:11.5px">지금은 <b style="color:var(--ink-2)">XMP 내보내기</b>로 ' +
      '프리셋을 파일로 공유할 수 있습니다.<br>보관함에서 프리셋을 길게 눌러 보세요.</p>';
    host.appendChild(up);
  }

  /* ══════════════ 설정 ══════════════ */
  function buildSettings() {
    var host = $('#setBody');
    host.innerHTML = '';
    var s = Store.getSettings();
    var g = el('div', 'set-group');

    function toggle(title, desc, key, onChange) {
      var row = el('div', 'set-item');
      row.innerHTML = '<div class="set-label"><b></b><span></span></div>';
      $('b', row).textContent = title;
      $('span', row).textContent = desc;
      var sw = el('div', 'switch' + (s[key] ? ' on' : ''));
      row.appendChild(sw);
      sw.addEventListener('click', function () {
        var v = !Store.getSettings()[key];
        Store.setSetting(key, v);
        sw.classList.toggle('on', v);
        Store.haptic(10);
        if (onChange) onChange(v);
      });
      g.appendChild(row);
    }

    function seg(title, desc, key, opts) {
      var row = el('div', 'set-item');
      row.innerHTML = '<div class="set-label"><b></b><span></span></div>';
      $('b', row).textContent = title;
      $('span', row).textContent = desc;
      var wrap = el('div', 'seg');
      opts.forEach(function (o) {
        var b = el('button', Store.getSettings()[key] === o.v ? 'on' : '', o.t);
        b.addEventListener('click', function () {
          Store.setSetting(key, o.v);
          $$('button', wrap).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          if (key === 'previewScale') { Store.toast('다음 촬영부터 적용됩니다'); layoutFrame(); }
          Store.haptic(10);
        });
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
      g.appendChild(row);
    }

    seg('사진 화질', '압축률과 저장 해상도를 함께 조절합니다', 'photoQuality', [
      { v: 'light', t: '가볍게' }, { v: 'normal', t: '표준' }, { v: 'high', t: '최고' }
    ]);
    toggle('JPEG 로 저장', '용량이 작고 어디서나 열립니다', 'saveJpeg');
    toggle('무손실 PNG 로도 저장', '압축 손실이 없는 대신 용량이 훨씬 큽니다', 'savePng');
    toggle('자동 화이트밸런스', '노란기·파란기를 빼고 중간값을 맞춥니다', 'autoWB', function (on) {
      if (on) Cam.startAWB(); else Cam.clearAWB();
    });
    seg('미리보기 화질', '높을수록 선명하지만 배터리를 더 씁니다', 'previewScale', [
      { v: 'perf', t: '가볍게' }, { v: 'auto', t: '자동' }, { v: 'high', t: '최고' }
    ]);
    toggle('전면 카메라 좌우 반전', '셀카를 거울처럼 저장합니다', 'mirrorFront');
    toggle('원본도 함께 저장', '보정 전 사진을 한 장 더 남깁니다', 'saveOriginal');
    toggle('진동 반응', '버튼을 누를 때 짧게 진동합니다', 'haptics');
    host.appendChild(g);

    var note = el('div', 'lib-note');
    note.innerHTML =
      '<b>RAW(DNG) 는 아직 저장할 수 없습니다.</b> 브라우저는 센서 원본에 접근할 ' +
      '방법을 주지 않아, 앱이 받는 것은 기기가 이미 현상해 넘긴 화면입니다. ' +
      '무손실 PNG 는 그 화면을 손실 없이 담는 것이지 RAW 가 아닙니다.<br>' +
      '진짜 DNG 를 남기려면 안드로이드 Camera2 를 직접 쓰는 네이티브 플러그인이 필요합니다.';
    host.appendChild(note);

    var about = el('div', 'about');
    about.innerHTML =
      'LUME · 버전 1.0.0<br>' +
      '라이트룸 XMP 프리셋을 실시간 카메라에 적용합니다.<br><br>' +
      '사진과 영상은 찍는 즉시 <b>문서/LUME</b> 폴더에 저장됩니다.<br>' +
      '프리셋은 앱 안에 저장되므로, 중요한 프리셋은<br>XMP 로 내보내 백업해 두세요.';
    host.appendChild(about);
  }

  /* ══════════════ 화면 비율 ══════════════ */
  function layoutFrame() {
    var stage = $('#stage'), frame = $('#frame');
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var ar = Cam.ratioValue(S.ratio);
    var w = sw, h = w / ar;
    if (h > sh) { h = sh; w = h * ar; }
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    Cam.fitCanvas(w, h);
  }

  /* ══════════════ 촬영 ══════════════ */
  var busy = false;

  function shoot() {
    if (busy) return;
    if (S.mode === 'photo') return shootPhoto();
    return Cam.isRecording() ? stopVideo() : startVideo();
  }

  function shootPhoto() {
    busy = true;
    var flash = $('#shutterFlash');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    Store.haptic(24);

    var preset = activePreset(), amount = activeAmount();
    var s = Store.getSettings();
    var base = 'LUME_' + Store.stamp();

    /* 저장할 형식들 — 둘 다 켜면 같은 장면을 두 벌 남깁니다.
       둘 다 끈 경우엔 JPEG 로 (사진을 잃지 않는 쪽으로) */
    var formats = [];
    if (s.saveJpeg !== false) formats.push('image/jpeg');
    if (s.savePng) formats.push('image/png');
    if (!formats.length) formats.push('image/jpeg');

    /* 순서대로 찍어 저장합니다. 첫 장을 썸네일·미리보기로 씁니다 */
    var first = null;
    var chain = formats.reduce(function (p, type) {
      return p.then(function () {
        return Cam.capturePhoto(preset, amount, S.ratio, type).then(function (res) {
          var name = base + '.' + Cam.extForImage(type);
          if (!first) { first = res; setLastShot(res.blob, type, name); }
          return Store.saveFile(res.blob, name, { share: false });
        });
      });
    }, Promise.resolve());

    chain
      .then(function () {
        S.lastShot.saved = true;
        var what = formats.map(function (t) { return Cam.extForImage(t).toUpperCase(); }).join(' + ');
        Store.toast(Store.isNative() ? '문서/LUME 에 저장했습니다 · ' + what
                                     : '내려받았습니다 · ' + what);
      })
      .then(function () {
        if (!Store.getSettings().saveOriginal) return;
        var oType = formats[0];
        return Cam.captureOriginal(S.ratio, oType).then(function (o) {
          return Store.saveFile(o.blob, base + '_원본.' + Cam.extForImage(oType), { share: false })
            .catch(function () {});
        });
      })
      .catch(function (e) {
        Store.toast(e.message || '촬영 실패');
        console.warn(e);
      })
      .then(function () { busy = false; });
  }

  function startVideo() {
    busy = true;
    Cam.startRecording()
      .then(function () {
        $('#btnShutter').classList.add('recording');
        $('#recBar').classList.remove('hidden');
        Store.haptic(30);
      })
      .catch(function (e) { Store.toast(e.message || '녹화를 시작할 수 없습니다'); })
      .then(function () { busy = false; });
  }

  function stopVideo() {
    busy = true;
    Cam.stopRecording()
      .then(function (res) {
        $('#btnShutter').classList.remove('recording');
        $('#recBar').classList.add('hidden');
        var name = 'LUME_' + Store.stamp() + '.' + Cam.extFor(res.type);
        setLastShot(res.blob, res.type, name);
        Store.haptic(30);
        return autoSave(res.blob, name);
      })
      .catch(function (e) { Store.toast(e.message || '녹화 종료 실패'); })
      .then(function () { busy = false; });
  }

  /* ══════════════ 프로 조작 ══════════════
     기기가 알려주는 항목만 줄로 세웁니다. getCapabilities() 에 없으면
     브라우저가 그 조작을 열어주지 않는 것이므로 감춥니다. */

  var PRO_ROWS = [
    { key: 'iso',                  name: 'ISO',   fmt: function (v) { return String(Math.round(v)); } },
    { key: 'exposureTime',         name: '셔터',  fmt: fmtShutter },
    { key: 'exposureCompensation', name: '노출',  fmt: function (v) { return (v > 0 ? '+' : '') + (+v).toFixed(1) + ' EV'; } },
    { key: 'colorTemperature',     name: '색온도', fmt: function (v) { return Math.round(v) + 'K'; } },
    { key: 'focusDistance',        name: '초점',  fmt: function (v) { return (+v).toFixed(2); } }
  ];

  /* exposureTime 은 100µs 단위입니다 (W3C image-capture 규격) */
  function fmtShutter(v) {
    var sec = v / 10000;
    if (sec >= 1) return sec.toFixed(1) + '초';
    return '1/' + Math.round(1 / sec);
  }

  function buildPro() {
    var host = $('#proPanel');
    if (!host) return;
    host.innerHTML = '';

    var caps = Cam.proCaps();
    var vals = Cam.proValues();
    var shown = 0;

    PRO_ROWS.forEach(function (def) {
      var c = caps[def.key];
      if (!c) return;
      shown++;

      var row = el('div', 'pro-row');
      row.appendChild(el('span', 'pro-name', def.name));

      var auto = el('button', 'pro-auto on', 'AUTO');
      var input = document.createElement('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.value = vals[def.key] !== undefined ? vals[def.key] : (c.min + c.max) / 2;
      input.disabled = true;
      var out = el('span', 'pro-val', 'AUTO');

      function push() {
        Cam.setPro(def.key, +input.value)
          .then(function () { out.textContent = def.fmt(+input.value); })
          .catch(function () { out.textContent = '지원 안 함'; });
      }

      auto.addEventListener('click', function () {
        var toAuto = !auto.classList.contains('on');
        auto.classList.toggle('on', toAuto);
        input.disabled = toAuto;
        Store.haptic(10);
        if (toAuto) {
          out.textContent = 'AUTO';
          Cam.setPro(def.key, null).catch(function () {});
        } else {
          push();
        }
      });
      input.addEventListener('input', push);

      row.appendChild(auto); row.appendChild(input); row.appendChild(out);
      host.appendChild(row);
    });

    if (!shown) {
      host.appendChild(el('div', 'pro-note',
        '이 기기의 브라우저가 수동 조작을 열어주지 않습니다.\n' +
        'APK 로 설치하면 더 많은 항목이 열릴 수 있습니다.'));
    }
    /* 조리개는 어느 브라우저 API 에도 없고, 휴대폰 렌즈는 대개 고정입니다 */
    host.appendChild(el('div', 'pro-note', '조리개는 렌즈가 고정이라 조작 대상이 아닙니다'));
  }

  /* ══════════════ 히스토그램 ══════════════ */
  var histTimer = 0;

  function histTick() {
    var cv = $('#histCanvas');
    var gl = $('#gl');
    if (!cv || !gl) return;
    var px = Analyze.sample(gl);
    var h = Analyze.histogram(px);
    Analyze.drawHistogram(cv, h);

    var warn = $('#scopeWarn');
    var clip = Analyze.clipping(h);
    if (!clip) { warn.textContent = ''; return; }
    var hot = clip.high > 0.005, cold = clip.low > 0.005;
    warn.innerHTML =
      '<span class="' + (cold ? 'cold' : '') + '">어두움 ' + (clip.low * 100).toFixed(1) + '%</span>' +
      '<span class="' + (hot ? 'hot' : '') + '">날아감 ' + (clip.high * 100).toFixed(1) + '%</span>';
  }

  function setHistogram(on) {
    Store.setSetting('showHistogram', on);
    $('#scope').classList.toggle('hidden', !on);
    $('#btnHist').classList.toggle('on', on);
    if (histTimer) { clearInterval(histTimer); histTimer = 0; }
    if (on) { histTimer = setInterval(histTick, 200); histTick(); }
  }

  /* ══════════════ 프리셋 줄 · 프로 패널 여닫기 ══════════════ */
  function setPresetsOpen(on) {
    Store.setSetting('showPresets', on);
    $('#presetStrip').classList.toggle('hidden', !on);
    $('#btnPresets').classList.toggle('on', on);
    $('#intensityWrap').classList.toggle('hidden', !on || !S.currentId);
    layoutFrame();
  }

  function setProOpen(on) {
    S.proOpen = on;
    $('#proPanel').classList.toggle('hidden', !on);
    $('#btnPro').classList.toggle('on', on);
    if (on) buildPro();
    layoutFrame();
  }

  /* 찍는 즉시 문서/LUME 에 저장한다 (공유창은 띄우지 않음) */
  function autoSave(blob, name) {
    return Store.saveFile(blob, name, { share: false })
      .then(function (res) {
        S.lastShot.saved = true;
        Store.toast(res.where === 'download' ? '내려받았습니다 · ' + name : '문서/LUME 에 저장했습니다');
      })
      .catch(function (e) {
        Store.toast('자동 저장 실패 — 썸네일을 눌러 직접 저장하세요');
        console.warn(e);
      });
  }

  function setLastShot(blob, type, name) {
    if (S.lastShot && S.lastShot.url) URL.revokeObjectURL(S.lastShot.url);
    S.lastShot = { blob: blob, type: type, name: name, url: URL.createObjectURL(blob) };
    var t = $('#btnThumb');
    t.innerHTML = '';
    if (type.indexOf('image') === 0) {
      var img = el('img'); img.src = S.lastShot.url; t.appendChild(img);
    } else {
      var v = el('video'); v.src = S.lastShot.url; v.muted = true;
      v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover';
      t.appendChild(v);
    }
  }

  function openViewer() {
    if (!S.lastShot) return;
    var stage = $('#vwStage');
    stage.innerHTML = '';
    if (S.lastShot.type.indexOf('image') === 0) {
      var img = el('img'); img.src = S.lastShot.url; stage.appendChild(img);
      $('#vwTitle').textContent = '방금 찍은 사진';
    } else {
      var v = el('video'); v.src = S.lastShot.url; v.controls = true;
      v.setAttribute('playsinline', ''); v.autoplay = true; v.loop = true;
      stage.appendChild(v);
      $('#vwTitle').textContent = '방금 찍은 영상';
    }
    $('#screen-viewer').classList.add('active');
  }
  function closeViewer() {
    $('#screen-viewer').classList.remove('active');
    $('#vwStage').innerHTML = '';
  }

  function saveLastShot() {
    if (!S.lastShot) return;
    Store.saveFile(S.lastShot.blob, S.lastShot.name, {
      title: S.lastShot.name, dialogTitle: '저장 · 공유'
    }).then(function (res) {
      Store.toast(res.where === 'download' ? '내려받았습니다' : '문서/LUME 폴더에 저장했습니다');
    }).catch(function (e) { Store.toast('저장 실패: ' + (e.message || e)); });
  }

  /* ══════════════ 카메라 화면 조작 ══════════════ */
  function initCameraScreen() {
    $('#btnShutter').addEventListener('click', shoot);
    $('#btnThumb').addEventListener('click', openViewer);
    $('#btnFlip').addEventListener('click', function () {
      if (Cam.isRecording()) return Store.toast('녹화 중에는 전환할 수 없습니다');
      Store.haptic(12);
      Cam.flip().then(function () { syncTorchUI(); });
    });

    $$('#modeRow .mode').forEach(function (b) {
      b.addEventListener('click', function () {
        if (Cam.isRecording()) return Store.toast('녹화를 먼저 끝내주세요');
        $$('#modeRow .mode').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        S.mode = b.dataset.mode;
        $('#btnShutter').classList.toggle('video', S.mode === 'video');
        persist();
        Store.haptic(10);
      });
    });

    $('#btnRatio').addEventListener('click', function () {
      var order = ['3:4', '9:16', '1:1'];
      S.ratio = order[(order.indexOf(S.ratio) + 1) % order.length];
      $('#btnRatio').textContent = S.ratio;
      Store.setSetting('ratio', S.ratio);
      layoutFrame();
      Store.haptic(10);
    });

    $('#btnGrid').addEventListener('click', function () {
      S.grid = !S.grid;
      $('#grid').classList.toggle('grid-off', !S.grid);
      $('#btnGrid').classList.toggle('on', S.grid);
      Store.setSetting('grid', S.grid);
      Store.haptic(10);
    });

    $('#btnTorch').addEventListener('click', function () {
      if (!Cam.hasTorch()) return Store.toast('이 카메라는 플래시를 지원하지 않습니다');
      S.torch = !S.torch;
      Cam.setTorch(S.torch)
        .then(function () { $('#btnTorch').classList.toggle('on', S.torch); })
        .catch(function () { S.torch = false; Store.toast('플래시를 켤 수 없습니다'); });
      Store.haptic(10);
    });

    $('#btnHist').addEventListener('click', function () {
      setHistogram(!Store.getSettings().showHistogram);
      Store.haptic(10);
    });

    $('#btnPro').addEventListener('click', function () {
      setProOpen(!S.proOpen);
      Store.haptic(10);
    });

    $('#btnPresets').addEventListener('click', function () {
      setPresetsOpen(!Store.getSettings().showPresets);
      Store.haptic(10);
    });

    $('#btnLibrary').addEventListener('click', function () {
      buildLibrary(); openSheet('screen-library');
    });
    $('#btnSettings').addEventListener('click', function () {
      buildSettings(); openSheet('screen-settings');
    });
    $('#btnEdit').addEventListener('click', function () { openEditor(null); });

    var intensity = $('#intensity');
    intensity.addEventListener('input', function () {
      S.amount = +intensity.value / 100;
      $('#intensityVal').textContent = intensity.value;
      var r = Cam.getRenderer();
      if (r && r.ok && !S.editing) r.setAmount(activeAmount());
    });
    intensity.addEventListener('change', persist);

    /* 탭 초점 · 핀치 줌 */
    var frame = $('#frame');
    var pinch = null;
    frame.addEventListener('pointerdown', function (e) {
      if (e.isPrimary && e.pointerType === 'touch') {
        /* 두 손가락 판별은 touch 이벤트로 처리 */
      }
    });
    frame.addEventListener('click', function (e) {
      if (pinch) return;
      var r = frame.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
      Cam.focusAt(nx, ny);
      var ring = $('#focusRing');
      ring.style.left = (e.clientX - r.left) + 'px';
      ring.style.top = (e.clientY - r.top) + 'px';
      ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
      Store.haptic(8);
    });

    frame.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        var z = Cam.getZoom();
        pinch = { d: dist(e.touches), z: z ? z.value : 1, cap: z };
      }
    }, { passive: true });
    frame.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2 && pinch.cap) {
        var ratio = dist(e.touches) / pinch.d;
        Cam.setZoom(pinch.z * ratio).catch(function () {});
      }
    }, { passive: true });
    frame.addEventListener('touchend', function () {
      setTimeout(function () { pinch = null; }, 60);
    });
    function dist(t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }

    $('#btnRetryCam').addEventListener('click', function () {
      $('#camError').classList.add('hidden');
      Cam.start().catch(function () {});
    });
  }

  function syncTorchUI() {
    S.torch = false;
    $('#btnTorch').classList.remove('on');
    $('#btnTorch').style.opacity = Cam.hasTorch() ? '' : '.4';
    /* 카메라가 새로 열릴 때마다 지원 항목이 달라질 수 있습니다 (전/후면 전환) */
    if (S.proOpen) buildPro();
  }

  /* ══════════════ 시트/뷰어 버튼 ══════════════ */
  function initSheets() {
    $('#libClose').addEventListener('click', function () { closeSheet('screen-library'); });
    $('#setClose').addEventListener('click', function () { closeSheet('screen-settings'); });
    $('#vwClose').addEventListener('click', closeViewer);
    $('#vwSave').addEventListener('click', saveLastShot);

    $('#libImport').addEventListener('click', function () { $('#fileXmp').click(); });
    $('#fileXmp').addEventListener('change', function (e) {
      importFiles(e.target.files);
      e.target.value = '';
    });

    $$('#libTabs .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('#libTabs .tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        S.libTab = t.dataset.lib;
        $$('[data-libpane]').forEach(function (p) {
          p.classList.toggle('active', p.dataset.libpane === S.libTab);
        });
        if (S.libTab === 'store') buildStore();
        else refreshLibThumbs();
      });
    });
  }

  /* ══════════════ 뒤로가기 ══════════════ */
  function handleBack() {
    if ($('#screen-viewer').classList.contains('active')) { closeViewer(); return true; }
    if ($('.modal-ov.on')) {
      var m = $('.modal-ov.on');
      if (m) { m.classList.remove('on'); setTimeout(function () { m.remove(); }, 200); return true; }
    }
    if ($('#screen-editor').classList.contains('active')) { closeEditor(false); return true; }
    if ($('#screen-library').classList.contains('active')) { closeSheet('screen-library'); return true; }
    if ($('#screen-settings').classList.contains('active')) { closeSheet('screen-settings'); return true; }
    return false;
  }

  /* ══════════════ 부팅 ══════════════ */
  function boot() {
    /* 프리셋 로드 */
    var user = Store.loadPresets().map(function (p) { return XMP.normalize(p); });
    S.presets = BUILTIN_PRESETS.concat(user);

    var st = Store.loadState();
    var s = Store.getSettings();
    S.ratio = s.ratio || '3:4';
    S.grid = !!s.grid;
    S.mode = st.mode || 'photo';
    S.amount = typeof st.amount === 'number' ? st.amount : 1;
    if (st.currentId && findPreset(st.currentId)) S.currentId = st.currentId;

    $('#btnRatio').textContent = S.ratio;
    $('#grid').classList.toggle('grid-off', !S.grid);
    $('#btnGrid').classList.toggle('on', S.grid);
    $('#intensity').value = Math.round(S.amount * 100);
    $('#intensityVal').textContent = Math.round(S.amount * 100);
    paintRange($('#intensity'));
    setPresetsOpen(s.showPresets !== false);
    setHistogram(!!s.showHistogram);
    $$('#modeRow .mode').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === S.mode);
    });
    $('#btnShutter').classList.toggle('video', S.mode === 'video');

    initCameraScreen();
    initEditor();
    initSheets();
    buildRail();

    layoutFrame();
    global.addEventListener('resize', layoutFrame);
    global.addEventListener('orientationchange', function () { setTimeout(layoutFrame, 300); });

    Cam.on('error', function (msg) {
      $('#camErrorText').textContent = msg;
      $('#camError').classList.remove('hidden');
    });
    Cam.on('started', function () {
      $('#camError').classList.add('hidden');
      syncTorchUI();
      layoutFrame();
      applyToRenderer();
      setTimeout(refreshThumbs, 400);
    });
    Cam.on('rectime', function (ms) {
      var t = Math.floor(ms / 1000);
      var mm = String(Math.floor(t / 60)).padStart(2, '0');
      var ss = String(t % 60).padStart(2, '0');
      $('#recTime').textContent = mm + ':' + ss;
    });

    /* 썸네일 주기 갱신 */
    setInterval(function () {
      if (!Cam.isRunning() || Cam.isRecording()) return;
      if (document.hidden) return;
      refreshThumbs();
    }, 2200);
  }

  global.UI = {
    boot: boot, handleBack: handleBack, layoutFrame: layoutFrame,
    applyToRenderer: applyToRenderer, state: S,
    importFiles: importFiles, buildRail: buildRail, buildLibrary: buildLibrary
  };
})(window);
