/* app.js — 부팅 · 뒤로가기 */

(function () {

  document.addEventListener('DOMContentLoaded', () => {
    UI.start();
    hookBack();
    hookCapacitor();
  });

  /* 브라우저·안드로이드 뒤로가기를 앱 안 뒤로가기로 씁니다.
   * 히스토리에 자리를 하나 잡아두고, 뒤로 갈 때마다 다시 채워 넣습니다. */
  function hookBack() {
    history.replaceState({ app: true }, '');
    history.pushState({ app: true }, '');

    window.addEventListener('popstate', () => {
      history.pushState({ app: true }, '');
      if (UI.sheetOpen) { UI.closeSheet(); return; }
      if (UI.stackDepth) { UI.back(); return; }
      // 더 갈 데가 없으면 그냥 둡니다 — 브라우저에서는 여기서 멈춥니다.
    });
  }

  /* Capacitor 로 감쌌을 때만 동작합니다. 웹에서는 조용히 넘어갑니다. */
  function hookCapacitor() {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App) return;
    App.addListener('backButton', () => {
      if (UI.sheetOpen) { UI.closeSheet(); return; }
      if (UI.stackDepth) { UI.back(); return; }
      App.exitApp();
    });
  }

})();
