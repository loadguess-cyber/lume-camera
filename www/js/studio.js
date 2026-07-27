/* ══════════════════════════════════════════════════════════
   studio.js — 프리셋 중심 사진 편집 · 일괄 처리

   원본은 절대 건드리지 않습니다. 사진마다 "어떤 프리셋을 몇 %"
   만 기억해 두고, 내보낼 때 원본에서 다시 렌더합니다.
   그래서 몇 번을 다시 뽑아도 화질이 깎이지 않습니다.
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var MAX_EDGE = 4096;    /* 이보다 큰 사진은 줄여 담습니다 (GPU 한계) */
  var THUMB = 88;         /* 트레이·프리셋 썸네일 (2배 해상도) */
  var GRID = 360;         /* 격자 비교 칸 */

  /* ── 상태 ────────────────────────────────── */
  var photos = [];        /* {id, name, canvas, w, h, presetId, amount, sel} */
  var presets = [];       /* {id, name, by, preset} */
  var curId = null;       /* 지금 보고 있는 사진 */
  var renderer = null;
  var seq = 0;

  function cur() {
    for (var i = 0; i < photos.length; i++) if (photos[i].id === curId) return photos[i];
    return null;
  }
  function presetOf(id) {
    for (var i = 0; i < presets.length; i++) if (presets[i].id === id) return presets[i];
    return null;
  }
  function selected() {
    return photos.filter(function (p) { return p.sel; });
  }

  /* ── 프리셋 목록 ─────────────────────────── */
  function initPresets() {
    presets = [{ id: '__none', name: '원본', by: '보정 없음', preset: XMP.neutral() }]
      .concat(BUILTIN_PRESETS.map(function (p) {
        return { id: p.id, name: p.name, by: p.author || 'LUME', preset: p };
      }));
  }

  /* ── 렌더 ────────────────────────────────── */
  function ready() {
    if (renderer && renderer.ok) return true;
    renderer = new GL.Renderer($('#view'));
    if (!renderer.ok) { toast(renderer.error || '이 브라우저에서 WebGL 을 쓸 수 없습니다'); return false; }
    return true;
  }

  /* 원본 캔버스에 프리셋을 걸어 목표 크기로 그립니다 */
  function renderPhoto(photo, w, h) {
    var e = presetOf(photo.presetId) || presets[0];
    return GL.renderTo(photo.canvas, e.preset, photo.amount / 100, w, h, false);
  }

  function paint() {
    var p = cur();
    if (!p || !ready()) return;

    /* 화면에 들어갈 만큼만 그립니다 — 원본 그대로 그리면 느립니다 */
    var box = $('#viewWrap').getBoundingClientRect();
    var maxW = Math.max(200, box.width - 44), maxH = Math.max(200, box.height - 44);
    var k = Math.min(maxW / p.w, maxH / p.h, 1);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var vw = Math.max(2, Math.round(p.w * k * dpr)), vh = Math.max(2, Math.round(p.h * k * dpr));

    var e = presetOf(p.presetId) || presets[0];
    renderer.setSize(vw, vh);
    renderer.setPreset(e.preset, p.amount / 100);
    renderer.draw(p.canvas, { freezeGrain: true });

    var view = $('#view');
    view.style.width = Math.round(p.w * k) + 'px';
    view.style.height = Math.round(p.h * k) + 'px';

    $('#tag').innerHTML = e.id === '__none'
      ? '원본'
      : esc(e.name) + ' <span class="pct">' + p.amount + '%</span>';
    $('#meta').textContent = p.w + ' × ' + p.h + '  ·  ' + p.name;

    if (!$('#scope').hidden) drawScope();
  }

  function drawScope() {
    var px = Analyze.sample($('#view'));
    Analyze.drawHistogram($('#hist'), Analyze.histogram(px));
  }

  /* ── 사진 넣기 ───────────────────────────── */
  function addCanvas(canvas, name) {
    var p = {
      id: 'p' + (++seq), name: name || ('사진 ' + seq),
      canvas: canvas, w: canvas.width, h: canvas.height,
      presetId: '__none', amount: 100, sel: true
    };
    photos.push(p);
    if (!curId) curId = p.id;
    return p;
  }

  function shrink(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var k = Math.min(1, MAX_EDGE / Math.max(w, h));
    var cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(w * k));
    cv.height = Math.max(2, Math.round(h * k));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }

  function openFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) {
      return /^image\//.test(f.type);
    });
    if (!list.length) return toast('이미지 파일이 아닙니다');

    var done = 0;
    list.forEach(function (f) {
      var url = URL.createObjectURL(f);
      var im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        addCanvas(shrink(im), f.name);
        if (++done === list.length) enterWork();
      };
      im.onerror = function () {
        URL.revokeObjectURL(url);
        if (++done === list.length) enterWork();
        toast(f.name + ' 을(를) 열지 못했습니다');
      };
      im.src = url;
    });
  }

  function enterWork() {
    $('#start').hidden = true;
    $('#work').hidden = false;
    $('#counts').hidden = false;
    $('#bExport').disabled = photos.length === 0;
    buildTray();
    buildPresetList();
    paint();
    updateCounts();
  }

  /* ── 사진 트레이 ─────────────────────────── */
  function buildTray() {
    var host = $('#trayList');
    host.textContent = '';
    photos.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'tcard' + (p.id === curId ? ' cur' : '') + (p.sel ? ' sel' : '');

      var cv = document.createElement('canvas');
      cv.width = THUMB; cv.height = THUMB;
      var made = renderPhoto(p, THUMB, THUMB);
      if (made) cv.getContext('2d').drawImage(made, 0, 0);
      card.appendChild(cv);

      var mark = document.createElement('div');
      mark.className = 'tmark';
      mark.textContent = '✓';
      mark.addEventListener('click', function (ev) {
        ev.stopPropagation();
        p.sel = !p.sel;
        card.classList.toggle('sel', p.sel);
        updateCounts();
      });
      card.appendChild(mark);

      var del = document.createElement('button');
      del.className = 'tdel';
      del.textContent = '×';
      del.title = '빼기';
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        photos = photos.filter(function (x) { return x.id !== p.id; });
        if (curId === p.id) curId = photos.length ? photos[0].id : null;
        if (!photos.length) { location.reload(); return; }
        buildTray(); buildPresetList(); paint(); updateCounts();
      });
      card.appendChild(del);

      var nm = document.createElement('div');
      nm.className = 'tname';
      nm.textContent = p.name;
      card.appendChild(nm);

      card.addEventListener('click', function () {
        curId = p.id;
        $('#amt').value = p.amount;
        $('#amtv').textContent = p.amount + '%';
        paintAmt();
        buildTray(); buildPresetList(); paint();
      });
      host.appendChild(card);
    });
  }

  function updateCounts() {
    $('#cntPhotos').textContent = photos.length + '장';
    $('#cntSel').textContent = selected().length + '장 선택';
    $('#bExport').disabled = photos.length === 0;
  }

  /* ── 프리셋 목록 (현재 사진으로 미리보기) ── */
  function buildPresetList() {
    var host = $('#presetList');
    host.textContent = '';
    var p = cur();
    if (!p) return;

    presets.forEach(function (e) {
      var row = document.createElement('button');
      row.className = 'prow' + (e.id === p.presetId ? ' on' : '');
      row.type = 'button';

      var cv = document.createElement('canvas');
      cv.width = THUMB; cv.height = THUMB;
      var made = GL.renderTo(p.canvas, e.preset, 1, THUMB, THUMB, false);
      if (made) cv.getContext('2d').drawImage(made, 0, 0);
      row.appendChild(cv);

      var meta = document.createElement('div');
      meta.className = 'pmeta';
      var nm = document.createElement('div');
      nm.className = 'pname'; nm.textContent = e.name;
      var by = document.createElement('div');
      by.className = 'pby'; by.textContent = e.by;
      meta.appendChild(nm); meta.appendChild(by);
      row.appendChild(meta);

      row.addEventListener('click', function () { pick(e.id); });
      host.appendChild(row);
    });
  }

  function pick(id) {
    var p = cur();
    if (!p) return;
    p.presetId = id;
    buildPresetList();
    buildTray();
    paint();
  }

  /* ── 원본과 비교 ─────────────────────────── */
  var held = false;
  function peek(on) {
    var p = cur();
    if (!p || held === on || !renderer) return;
    held = on;
    $('#bCompare').classList.toggle('held', on);
    if (on) {
      renderer.setPreset(XMP.neutral(), 1);
      renderer.draw(p.canvas, { freezeGrain: true });
      $('#tag').textContent = '원본';
    } else paint();
  }

  /* ── 격자 비교 ───────────────────────────── */
  function openGrid() {
    var p = cur();
    if (!p) return;
    var host = $('#gridBody');
    host.textContent = '';
    var h = Math.round(GRID * p.h / p.w);

    presets.forEach(function (e) {
      var cell = document.createElement('div');
      cell.className = 'gcell' + (e.id === p.presetId ? ' on' : '');
      var cv = document.createElement('canvas');
      cv.width = GRID; cv.height = h;
      var made = GL.renderTo(p.canvas, e.preset, p.amount / 100, GRID, h, false);
      if (made) cv.getContext('2d').drawImage(made, 0, 0);
      cell.appendChild(cv);
      var nm = document.createElement('span');
      nm.textContent = e.name;
      cell.appendChild(nm);
      cell.addEventListener('click', function () {
        pick(e.id);
        $('#gridOv').hidden = true;
      });
      host.appendChild(cell);
    });
    $('#gridOv').hidden = false;
  }

  /* ── 내보내기 ────────────────────────────── */
  function segValue(id) {
    var on = document.querySelector('#' + id + ' button.on');
    return on ? on.dataset.v : null;
  }

  function wireSeg(id, onChange) {
    var host = $('#' + id);
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      Array.prototype.forEach.call(host.children, function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      if (onChange) onChange(b.dataset.v);
    });
  }

  function runExport() {
    var who = segValue('expWho');
    var fmt = segValue('expFmt');
    var size = +segValue('expSize') || 0;
    var q = +$('#expQ').value / 100;

    var list = who === 'all' ? photos.slice() : selected();
    if (!list.length) return toast('내보낼 사진이 없습니다');

    var log = $('#expLog');
    var btn = $('#bRun');
    btn.disabled = true;
    log.textContent = '';

    var made = [];
    var i = 0;

    function step() {
      if (i >= list.length) return finish();
      var p = list[i];
      log.textContent = '렌더 중  ' + (i + 1) + ' / ' + list.length + '   ' + p.name;

      var w = p.w, h = p.h;
      if (size) {
        var k = size / Math.max(w, h);
        if (k < 1) { w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k)); }
      }

      var cv = renderPhoto(p, w, h);
      if (!cv) { i++; return setTimeout(step, 0); }

      cv.toBlob(function (blob) {
        if (blob) {
          var e = presetOf(p.presetId);
          var tag = (e && e.id !== '__none') ? '_' + XMP.safeFileName(e.name) : '';
          made.push({ name: stem(p.name) + tag + '.' + (fmt === 'image/png' ? 'png' : 'jpg'), blob: blob });
        }
        i++;
        setTimeout(step, 0);   /* 화면이 멈추지 않도록 한 장씩 */
      }, fmt, fmt === 'image/jpeg' ? q : undefined);
    }

    function finish() {
      if (!made.length) { btn.disabled = false; return toast('내보낼 것이 없습니다'); }
      if (made.length === 1) {
        download(made[0].blob, made[0].name);
        log.innerHTML = '<span class="done">' + esc(made[0].name) + ' 내려받았습니다</span>';
        btn.disabled = false;
        return;
      }
      log.textContent = 'ZIP 으로 묶는 중…';
      Zip.fromBlobs(made).then(function (zip) {
        var name = 'LUME_' + stamp() + '_' + made.length + '장.zip';
        download(zip, name);
        log.innerHTML = '<span class="done">' + made.length + '장을 ' + esc(name) +
          ' 으로 내려받았습니다 (' + mb(zip.size) + ')</span>';
        btn.disabled = false;
      }).catch(function (e) {
        log.textContent = '실패: ' + (e.message || e);
        btn.disabled = false;
      });
    }

    setTimeout(step, 0);
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
  }

  function stem(n) {
    var i = n.lastIndexOf('.');
    return i > 0 ? n.slice(0, i) : n;
  }
  function mb(n) { return (n / 1048576).toFixed(1) + 'MB'; }
  function stamp() {
    var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── 배선 ────────────────────────────────── */
  function paintAmt() {
    var a = $('#amt');
    a.style.setProperty('--p', a.value + '%');
  }

  function init() {
    initPresets();

    $('#bAdd').addEventListener('click', function () { $('#fPhoto').click(); });
    $('#bAdd2').addEventListener('click', function () { $('#fPhoto').click(); });
    $('#fPhoto').addEventListener('change', function (e) {
      openFiles(e.target.files); e.target.value = '';
    });

    $('#bSample').addEventListener('click', function () {
      addCanvas(SAMPLE.draw(document.createElement('canvas'), 1600, 1200), '샘플 장면.png');
      enterWork();
    });

    $('#bXmp').addEventListener('click', function () { $('#fXmp').click(); });
    $('#fXmp').addEventListener('change', function (e) {
      loadXmp(e.target.files); e.target.value = '';
    });

    $('#amt').addEventListener('input', function () {
      var p = cur();
      $('#amtv').textContent = $('#amt').value + '%';
      paintAmt();
      if (!p) return;
      p.amount = +$('#amt').value;
      paint();
    });
    $('#amt').addEventListener('change', buildTray);

    $('#bSelAll').addEventListener('click', function () {
      var allOn = photos.every(function (p) { return p.sel; });
      photos.forEach(function (p) { p.sel = !allOn; });
      buildTray(); updateCounts();
    });

    $('#bApplyAll').addEventListener('click', function () {
      var p = cur();
      if (!p) return;
      var list = selected();
      if (!list.length) return toast('선택된 사진이 없습니다');
      list.forEach(function (x) { x.presetId = p.presetId; x.amount = p.amount; });
      buildTray();
      toast(list.length + '장에 적용했습니다');
    });

    ['mousedown', 'touchstart'].forEach(function (ev) {
      $('#bCompare').addEventListener(ev, function (e) { e.preventDefault(); peek(true); });
    });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) {
      $('#bCompare').addEventListener(ev, function () { peek(false); });
    });

    $('#bScope').addEventListener('click', function () {
      var s = $('#scope');
      s.hidden = !s.hidden;
      $('#bScope').classList.toggle('on', !s.hidden);
      if (!s.hidden) drawScope();
    });

    $('#bGridView').addEventListener('click', openGrid);
    $('#bGridClose').addEventListener('click', function () { $('#gridOv').hidden = true; });

    $('#bExport').addEventListener('click', function () { $('#expOv').hidden = false; });
    $('#bExpClose').addEventListener('click', function () { $('#expOv').hidden = true; });
    $('#bRun').addEventListener('click', runExport);

    wireSeg('expWho'); wireSeg('expSize');
    wireSeg('expFmt', function (v) {
      $('#expQWrap').style.display = v === 'image/png' ? 'none' : '';
    });
    $('#expQ').addEventListener('input', function () {
      $('#expQv').textContent = $('#expQ').value;
    });

    /* 끌어다 놓기 */
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); $('#start').classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); $('#start').classList.remove('over'); });
    });
    document.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      var xmps = Array.prototype.filter.call(files, function (f) { return /\.xmp$/i.test(f.name); });
      var imgs = Array.prototype.filter.call(files, function (f) { return !/\.xmp$/i.test(f.name); });
      if (xmps.length) loadXmp(xmps);
      if (imgs.length) openFiles(imgs);
    });

    /* 좌우 키로 사진 넘기기 */
    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (photos.length < 2) return;
      var i = photos.findIndex(function (p) { return p.id === curId; });
      i = (i + (e.key === 'ArrowRight' ? 1 : photos.length - 1)) % photos.length;
      curId = photos[i].id;
      $('#amt').value = photos[i].amount;
      $('#amtv').textContent = photos[i].amount + '%';
      paintAmt();
      buildTray(); buildPresetList(); paint();
    });

    global.addEventListener('resize', function () { if (cur()) paint(); });
    paintAmt();
  }

  function loadXmp(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var added = 0, done = 0;
    list.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () {
        var parsed = XMP.parse(String(r.result));
        if (parsed) {
          parsed.name = parsed.name || f.name.replace(/\.xmp$/i, '');
          presets.push({
            id: 'x' + (++seq), name: parsed.name,
            by: parsed.author || '불러온 프리셋', preset: parsed
          });
          added++;
        }
        if (++done === list.length) after();
      };
      r.onerror = function () { if (++done === list.length) after(); };
      r.readAsText(f);
    });
    function after() {
      if (!added) return toast('XMP 를 해석하지 못했습니다');
      if (photos.length) buildPresetList();
      toast('프리셋 ' + added + '개를 넣었습니다');
    }
  }

  var tt = 0;
  function toast(m) {
    var el = $('#toast');
    el.textContent = m;
    el.classList.add('on');
    clearTimeout(tt);
    tt = setTimeout(function () { el.classList.remove('on'); }, 2400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
