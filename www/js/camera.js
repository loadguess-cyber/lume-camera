/* ══════════════════════════════════════════════════════════
   camera.js — 카메라 제어 · 사진 촬영 · 영상 녹화
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var video, canvas, renderer;
  var stream = null, track = null, audioStream = null;
  var facing = 'environment';
  var running = false, rafId = 0, vfcId = 0;
  var recorder = null, chunks = [], recStart = 0, recTimer = 0;
  var listeners = {};

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(function (f) { f(data); }); }

  /* ── 초기화 ─────────────────────────────── */
  function init(videoEl, canvasEl) {
    video = videoEl;
    canvas = canvasEl;
    renderer = new GL.Renderer(canvas);
    if (!renderer.ok) emit('error', renderer.error || 'WebGL 초기화 실패');
    return renderer;
  }

  function getRenderer() { return renderer; }
  function isMirrored() { return facing === 'user'; }
  function getFacing() { return facing; }

  /* ── 카메라 시작 ────────────────────────── */
  function start(which) {
    if (which) facing = which;
    stop(true);

    var s = Store.getSettings();
    var wantW = s.previewScale === 'perf' ? 1280 : 1920;
    var constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width:  { ideal: wantW },
        height: { ideal: Math.round(wantW * 9 / 16) },
        frameRate: { ideal: 30 }
      }
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      emit('error', '이 환경에서는 카메라를 쓸 수 없습니다');
      return Promise.reject(new Error('getUserMedia 없음'));
    }

    return navigator.mediaDevices.getUserMedia(constraints)
      .catch(function () {
        /* 이상적인 해상도로 실패하면 조건을 낮춰 재시도 */
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      })
      .then(function (st) {
        stream = st;
        track = st.getVideoTracks()[0];
        video.srcObject = st;
        video.muted = true;
        video.setAttribute('playsinline', '');
        return video.play().catch(function () {});
      })
      .then(function () {
        running = true;
        emit('started', capabilities());
        loop();
      })
      .catch(function (err) {
        var msg = '카메라를 열 수 없습니다';
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError'))
          msg = '카메라 권한이 필요합니다.\n설정에서 권한을 허용해 주세요.';
        else if (err && err.name === 'NotFoundError') msg = '사용할 수 있는 카메라가 없습니다';
        else if (err && err.name === 'NotReadableError') msg = '다른 앱이 카메라를 쓰고 있습니다';
        emit('error', msg);
        throw err;
      });
  }

  function stop(keepRunning) {
    if (!keepRunning) running = false;
    cancelLoop();
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    track = null;
    if (video) video.srcObject = null;
  }

  function flip() {
    return start(facing === 'environment' ? 'user' : 'environment');
  }

  /* ── 카메라 기능 조회 ───────────────────── */
  function capabilities() {
    if (!track || !track.getCapabilities) return {};
    try { return track.getCapabilities() || {}; } catch (e) { return {}; }
  }
  function settingsOf() {
    if (!track || !track.getSettings) return {};
    try { return track.getSettings() || {}; } catch (e) { return {}; }
  }

  function setTorch(onOff) {
    if (!track) return Promise.reject();
    return track.applyConstraints({ advanced: [{ torch: !!onOff }] });
  }
  function hasTorch() { return !!capabilities().torch; }

  function setZoom(z) {
    var cap = capabilities();
    if (!cap.zoom) return Promise.reject();
    var v = Store.clamp(z, cap.zoom.min, cap.zoom.max);
    return track.applyConstraints({ advanced: [{ zoom: v }] }).then(function () { return v; });
  }
  function getZoom() {
    var cap = capabilities(), st = settingsOf();
    if (!cap.zoom) return null;
    return { value: st.zoom || cap.zoom.min, min: cap.zoom.min, max: cap.zoom.max, step: cap.zoom.step || 0.1 };
  }

  function focusAt(nx, ny) {
    if (!track) return;
    var cap = capabilities();
    var adv = [];
    if (cap.focusMode && cap.focusMode.indexOf('single-shot') >= 0) adv.push({ focusMode: 'single-shot' });
    if (cap.pointsOfInterest) adv.push({ pointsOfInterest: [{ x: nx, y: ny }] });
    if (!adv.length) return;
    try { track.applyConstraints({ advanced: adv }).catch(function () {}); } catch (e) {}
  }

  /* ── 렌더 루프 ──────────────────────────── */
  function loop() {
    cancelLoop();
    var useVFC = typeof video.requestVideoFrameCallback === 'function';
    var tick = function () {
      if (!running) return;
      if (video.readyState >= 2) renderer.draw(video, { mirror: isMirrored() });
      schedule();
    };
    var schedule = function () {
      if (useVFC) vfcId = video.requestVideoFrameCallback(tick);
      else rafId = requestAnimationFrame(tick);
    };
    schedule();
  }
  function cancelLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (vfcId && video && video.cancelVideoFrameCallback) {
      try { video.cancelVideoFrameCallback(vfcId); } catch (e) {}
      vfcId = 0;
    }
  }

  /* ── 미리보기 캔버스 크기 맞추기 ────────── */
  function fitCanvas(cssW, cssH) {
    var s = Store.getSettings();
    var dpr = global.devicePixelRatio || 1;
    var cap = s.previewScale === 'high' ? 2160 : (s.previewScale === 'perf' ? 1080 : 1600);
    var scale = Math.min(dpr, 2.5);
    var w = cssW * scale, h = cssH * scale;
    var longSide = Math.max(w, h);
    if (longSide > cap) { var k = cap / longSide; w *= k; h *= k; }
    renderer.setSize(w, h);
  }

  /* ── 사진 촬영 ──────────────────────────── */
  function capturePhoto(preset, amount, ratio) {
    return new Promise(function (resolve, reject) {
      if (!video || video.readyState < 2) return reject(new Error('카메라 준비 중입니다'));
      var vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return reject(new Error('영상 크기를 알 수 없습니다'));

      /* 화면 비율에 맞춰 잘라낸 최종 크기 계산 (원본 화소를 최대한 유지) */
      var ar = ratioValue(ratio);           // 가로/세로
      var out = fitRect(vw, vh, ar);
      var cv = GL.renderTo(video, preset, amount, out.w, out.h, isMirrored());
      if (!cv) return reject(new Error('렌더링 실패'));

      var q = Store.getSettings().quality;
      cv.toBlob(function (blob) {
        if (!blob) return reject(new Error('이미지 생성 실패'));
        resolve({ blob: blob, width: out.w, height: out.h, type: 'image/jpeg' });
      }, 'image/jpeg', q);
    });
  }

  /* 보정 없는 원본도 함께 저장할 때 사용 */
  function captureOriginal(ratio) {
    return capturePhoto(XMP.neutral(), 0, ratio);
  }

  function ratioValue(r) {
    if (r === '9:16') return 9 / 16;
    if (r === '1:1') return 1;
    return 3 / 4;   // 기본 3:4 (세로)
  }

  /* 소스 해상도 안에서 목표 비율의 최대 사각형 */
  function fitRect(vw, vh, targetAR) {
    /* 세로 화면 기준: 화면은 항상 세로로 쓰므로 짧은 변이 가로 */
    var portrait = vh >= vw;
    var sw = portrait ? vw : vh, sh = portrait ? vh : vw;
    var w = sw, h = Math.round(sw / targetAR);
    if (h > sh) { h = sh; w = Math.round(sh * targetAR); }
    return { w: Math.max(2, w - (w % 2)), h: Math.max(2, h - (h % 2)) };
  }

  /* ── 영상 녹화 ──────────────────────────── */
  function pickMime() {
    var list = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    if (typeof MediaRecorder === 'undefined') return null;
    for (var i = 0; i < list.length; i++) {
      if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    }
    return '';
  }

  function startRecording() {
    if (recorder) return Promise.reject(new Error('이미 녹화 중입니다'));
    if (typeof MediaRecorder === 'undefined')
      return Promise.reject(new Error('이 기기는 영상 녹화를 지원하지 않습니다'));

    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .catch(function () { return null; })     /* 마이크 거부 시 무음 녹화 */
      .then(function (aud) {
        audioStream = aud;
        var cs = canvas.captureStream(30);
        if (aud) aud.getAudioTracks().forEach(function (t) { cs.addTrack(t); });

        var mime = pickMime();
        var opt = { videoBitsPerSecond: Store.getSettings().videoBitrate };
        if (mime) opt.mimeType = mime;

        try { recorder = new MediaRecorder(cs, opt); }
        catch (e) { recorder = new MediaRecorder(cs); }

        chunks = [];
        recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.start(1000);
        recStart = Date.now();
        recTimer = setInterval(function () { emit('rectime', Date.now() - recStart); }, 250);
        emit('recstart');
        return true;
      });
  }

  function stopRecording() {
    return new Promise(function (resolve, reject) {
      if (!recorder) return reject(new Error('녹화 중이 아닙니다'));
      var rec = recorder;
      var type = rec.mimeType || 'video/webm';
      rec.onstop = function () {
        clearInterval(recTimer); recTimer = 0;
        recorder = null;
        if (audioStream) { audioStream.getTracks().forEach(function (t) { t.stop(); }); audioStream = null; }
        var blob = new Blob(chunks, { type: type });
        chunks = [];
        emit('recstop');
        resolve({ blob: blob, type: type, ms: Date.now() - recStart });
      };
      try { rec.stop(); } catch (e) { reject(e); }
    });
  }

  function isRecording() { return !!recorder; }

  function extFor(type) {
    if (!type) return 'webm';
    if (type.indexOf('mp4') >= 0) return 'mp4';
    return 'webm';
  }

  global.Cam = {
    init: init, start: start, stop: stop, flip: flip, on: on,
    getRenderer: getRenderer, fitCanvas: fitCanvas,
    isMirrored: isMirrored, getFacing: getFacing,
    capabilities: capabilities, hasTorch: hasTorch, setTorch: setTorch,
    setZoom: setZoom, getZoom: getZoom, focusAt: focusAt,
    capturePhoto: capturePhoto, captureOriginal: captureOriginal,
    startRecording: startRecording, stopRecording: stopRecording, isRecording: isRecording,
    ratioValue: ratioValue, extFor: extFor,
    isRunning: function () { return running; }
  };
})(window);
