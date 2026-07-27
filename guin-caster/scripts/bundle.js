/* ══════════════════════════════════════════════════════════
   bundle.js — 앱 전체를 파일 하나로 묶는다.
                실행:  node scripts/bundle.js

   www/ 는 파일이 여러 개라 정적 호스팅이 필요합니다.
   이 스크립트는 css·js 를 index.html 안에 넣어 dist/ 에 한 장으로 만듭니다.
   그 파일 하나만 있으면 어디서든 열립니다.

   두 벌을 만듭니다.
     dist/guin-caster.html         혼자 열리는 완전한 문서
     dist/guin-caster.body.html    <head> 를 감싸 주는 곳에 올릴 조각
   ══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW  = path.join(ROOT, 'www');
const DIST = path.join(ROOT, 'dist');

const read = (p) => fs.readFileSync(path.join(WWW, p), 'utf8');

let html = read('index.html');

/* ── 1. <link rel=stylesheet> → <style> ─────────────────── */
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = read(href);
  console.log('  css  ' + href + '  (' + (css.length / 1024).toFixed(1) + ' KB)');
  return '<style>\n' + css + '\n</style>';
});

/* ── 2. <script src> → 인라인 ───────────────────────────── */
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const js = read(src);
  console.log('  js   ' + src + '  (' + (js.length / 1024).toFixed(1) + ' KB)');
  // 스크립트 안의 </script> 가 문서를 일찍 닫아버리는 것을 막습니다.
  return '<script>\n' + js.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';
});

/* ── 3. 아이콘을 data URI 로 심기 ───────────────────────── */
const icon = fs.readFileSync(path.join(WWW, 'icon-192.png')).toString('base64');
html = html.replace(/href="icon-192\.png"/g, `href="data:image/png;base64,${icon}"`);

/* ── 4. manifest 는 파일 하나짜리에선 가리킬 곳이 없습니다 ── */
html = html.replace(/^\s*<link[^>]*rel="manifest"[^>]*>\s*$/gm, '');

fs.mkdirSync(DIST, { recursive: true });

/* 완전한 문서 */
const full = path.join(DIST, 'guin-caster.html');
fs.writeFileSync(full, html);

/* <head> 를 감싸 주는 곳(문서 뼈대가 이미 있는 호스팅)에 올릴 조각.
   껍데기를 벗기고 <title>·<style>·본문·<script> 만 남깁니다.       */
const title = (html.match(/<title>([^<]*)<\/title>/) || [, '구인 캐스터'])[1];
const head  = html.split('<head>')[1].split('</head>')[0];
const body  = html.split('<body>')[1].split('</body>')[0];

const styles = (head.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
// 폰 너비 선언은 조각에도 넣습니다. 감싸는 쪽이 안 넣어주면 데스크톱 폭으로 그려집니다.
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
const piece  = `<title>${title}</title>\n${viewport}\n${styles}\n${body.trim()}\n`;
fs.writeFileSync(path.join(DIST, 'guin-caster.body.html'), piece);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('\ndist/guin-caster.html       ' + kb(html.length) + '  (파일 하나로 열림)');
console.log('dist/guin-caster.body.html  ' + kb(piece.length) + '  (본문 조각)');
