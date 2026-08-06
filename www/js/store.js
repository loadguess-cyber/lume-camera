/* ══════════════════════════════════════════════════════════
   store.js — 저장소 · 네이티브 브리지 · 공통 유틸
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var KEY_PRESETS  = 'lume.presets.v1';
  var KEY_SETTINGS = 'lume.settings.v1';
  var KEY_STATE    = 'lume.state.v1';

  /* ── 로컬 저장 ────────────────────────────── */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('저장 실패', e); return false; }
  }

  /* ── 설정 ─────────────────────────────────── */
  var DEFAULT_SETTINGS = {
    ratio: '3:4',          // 3:4 · 9:16 · 1:1
    grid: false,
    mirrorFront: true,     // 전면 카메라 좌우 반전 저장
    quality: 0.95,
    videoBitrate: 12000000,
    shutterSound: false,
    haptics: true,
    saveOriginal: false,   // 보정 전 원본도 함께 저장
    previewScale: 'auto',  // auto · high · perf

    saveJpeg: true,        // JPEG 로 저장
    savePng: false,        // 무손실 PNG 로도 저장 (둘 다 켜면 두 장이 남습니다)
    photoQuality: 'high',  // high · normal · light
    maxResolution: true,   // 촬영 순간 사진용 경로로 최대 해상도 한 장 (ImageCapture)
    autoWB: true,          // 앱이 직접 계산하는 자동 화이트밸런스
    showHistogram: false,  // 히스토그램 표시
    showPresets: true      // 프리셋 줄 표시 (끄면 버튼으로 열고 닫습니다)
  };

  var settings = Object.assign({}, DEFAULT_SETTINGS, read(KEY_SETTINGS, {}));
  function getSettings() { return settings; }
  function setSetting(k, v) { settings[k] = v; write(KEY_SETTINGS, settings); }

  /* ── 프리셋 저장소 ─────────────────────────── */
  function loadPresets() { return read(KEY_PRESETS, []); }
  function savePresets(list) { return write(KEY_PRESETS, list); }

  /* ── 앱 상태(마지막 선택 프리셋 등) ─────────── */
  function loadState() { return read(KEY_STATE, {}); }
  function saveState(s) { write(KEY_STATE, s); }

  /* ── 네이티브(Capacitor) 감지 ──────────────── */
  function cap() { return global.Capacitor; }
  function isNative() {
    var c = cap();
    return !!(c && (c.isNativePlatform ? c.isNativePlatform() : c.isNative));
  }
  function plugin(name) {
    var c = cap();
    return c && c.Plugins ? c.Plugins[name] : null;
  }

  /* ── Blob → base64 ─────────────────────────── */
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(fr.error); };
      fr.onload = function () {
        var s = String(fr.result);
        resolve(s.slice(s.indexOf(',') + 1));
      };
      fr.readAsDataURL(blob);
    });
  }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' +
           p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* ── 파일 저장 (네이티브: 문서 폴더 + 공유창 / 웹: 다운로드) ── */
  function saveFile(blob, filename, opts) {
    opts = opts || {};
    if (!isNative()) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return Promise.resolve({ ok: true, where: 'download' });
    }

    var Filesystem = plugin('Filesystem');
    var Share = plugin('Share');
    if (!Filesystem) return Promise.reject(new Error('Filesystem 플러그인이 없습니다'));

    var path = 'LUME/' + filename;
    return blobToBase64(blob)
      .then(function (b64) {
        return Filesystem.writeFile({
          path: path, data: b64, directory: 'DOCUMENTS', recursive: true
        });
      })
      .then(function (res) {
        if (opts.share === false || !Share) return { ok: true, uri: res.uri, where: 'documents' };
        return Share.share({
          title: opts.title || filename,
          text: opts.text || '',
          url: res.uri,
          dialogTitle: opts.dialogTitle || '저장·공유'
        }).then(function () {
          return { ok: true, uri: res.uri, where: 'documents' };
        }, function () {
          // 사용자가 공유창을 닫아도 파일은 이미 저장됨
          return { ok: true, uri: res.uri, where: 'documents' };
        });
      });
  }

  /* ── 텍스트 파일 저장 (.xmp 내보내기) ──────── */
  function saveText(text, filename, opts) {
    return saveFile(new Blob([text], { type: 'application/xml' }), filename, opts);
  }

  /* ── 진동 ──────────────────────────────────── */
  function haptic(ms) {
    if (!settings.haptics) return;
    try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {}
  }

  /* ── 토스트 ────────────────────────────────── */
  var toastEl = null, toastTimer = 0;
  function toast(msg, ms) {
    if (!toastEl) toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, ms || 2000);
  }

  /* ── 기타 유틸 ─────────────────────────────── */
  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  global.Store = {
    getSettings: getSettings, setSetting: setSetting, DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    loadPresets: loadPresets, savePresets: savePresets,
    loadState: loadState, saveState: saveState,
    isNative: isNative, plugin: plugin,
    saveFile: saveFile, saveText: saveText, blobToBase64: blobToBase64,
    haptic: haptic, toast: toast, stamp: stamp,
    uid: uid, clamp: clamp, deepClone: deepClone
  };
})(window);
