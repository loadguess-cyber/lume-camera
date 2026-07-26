/* ══════════════════════════════════════════════════════════
   app.js — 부팅 · 안드로이드 뒤로가기 · 절전 처리
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function hideSplash() {
    var sp = document.getElementById('splash');
    if (sp) sp.classList.add('gone');
  }

  function start() {
    var video = document.getElementById('video');
    var canvas = document.getElementById('gl');

    var renderer = Cam.init(video, canvas);
    UI.boot();

    if (!renderer || !renderer.ok) {
      document.getElementById('camErrorText').textContent =
        'WebGL 을 사용할 수 없어 실시간 보정을 할 수 없습니다';
      document.getElementById('camError').classList.remove('hidden');
      setTimeout(hideSplash, 600);
      return;
    }

    /* 권한 창이 오래 떠 있어도 화면이 멈춰 보이지 않게 */
    setTimeout(hideSplash, 2600);

    Cam.start()
      .then(function () { setTimeout(hideSplash, 350); })
      .catch(function () { setTimeout(hideSplash, 350); });
  }

  /* 안드로이드 뒤로가기 — 열린 화면을 차례로 닫고, 없으면 앱 종료 */
  function bindBack() {
    var App = Store.plugin('App');
    if (App && App.addListener) {
      App.addListener('backButton', function () {
        if (UI.handleBack()) return;
        if (App.exitApp) App.exitApp();
      });
      App.addListener('appStateChange', function (st) {
        if (st && st.isActive === false) {
          if (!Cam.isRecording()) Cam.stop();
        } else if (st && st.isActive === true) {
          if (!Cam.isRunning()) Cam.start().catch(function () {});
        }
      });
    }
    /* 브라우저에서도 뒤로가기 흉내 */
    global.addEventListener('popstate', function () {
      if (UI.handleBack()) history.pushState(null, '', location.href);
    });
    try { history.pushState(null, '', location.href); } catch (e) {}
  }

  /* 화면이 가려지면 카메라를 놓아준다 (배터리·다른 앱 배려) */
  function bindVisibility() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (!Cam.isRecording()) Cam.stop();
      } else if (!Cam.isRunning()) {
        Cam.start().catch(function () {});
      }
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    /* 화면 확대 방지 */
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });

    start();
    bindBack();
    bindVisibility();
  });
})(window);
