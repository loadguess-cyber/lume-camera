/* ══════════════════════════════════════════════════════════
   patch-android.js
   `npx cap add android` 가 만든 네이티브 프로젝트에
   이 앱에 필요한 설정을 덧붙인다. 여러 번 실행해도 안전.
   ══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(MANIFEST)) {
  console.log('android 폴더가 없습니다 — `npx cap add android` 를 먼저 실행하세요.');
  process.exit(0);
}

let xml = fs.readFileSync(MANIFEST, 'utf8');
let changed = false;

/* 1. 다른 앱을 띄울 수 있게 -------------------------------
   안드로이드 11 부터는 여기에 적어두지 않은 앱은 설치돼 있어도
   "없는 것"으로 보입니다. 카카오톡·당근을 열려면 필요합니다.      */
if (xml.indexOf('<queries>') === -1) {
  const QUERIES = `
    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SEND" />
            <data android:mimeType="text/plain" />
        </intent>
        <package android:name="com.kakao.talk" />
        <package android:name="com.towneers.www" />
    </queries>
`;
  xml = xml.replace('</manifest>', QUERIES + '</manifest>');
  changed = true;
  console.log('queries 추가 (카카오톡 · 당근 열기용)');
}

/* 2. 세로 고정 ------------------------------------------- */
if (xml.indexOf('android:screenOrientation') === -1) {
  xml = xml.replace(
    /(<activity[^>]*android:name="\.MainActivity")/,
    '$1\n            android:screenOrientation="portrait"'
  );
  changed = true;
  console.log('MainActivity 세로 고정');
}

if (changed) {
  fs.writeFileSync(MANIFEST, xml);
  console.log('AndroidManifest.xml 수정 완료');
} else {
  console.log('AndroidManifest.xml — 변경할 것 없음');
}

/* 3. 앱 이름 --------------------------------------------- */
const STRINGS = path.join(ROOT, 'android/app/src/main/res/values/strings.xml');
if (fs.existsSync(STRINGS)) {
  let s = fs.readFileSync(STRINGS, 'utf8');
  const before = s;
  s = s.replace(/(<string name="app_name">)[^<]*(<\/string>)/, '$1구인 캐스터$2');
  s = s.replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, '$1구인 캐스터$2');
  if (s !== before) { fs.writeFileSync(STRINGS, s); console.log('앱 이름 → 구인 캐스터'); }
}

/* 4. 아이콘 배경색 --------------------------------------- */
const BG = path.join(ROOT, 'android/app/src/main/res/values/ic_launcher_background.xml');
if (fs.existsSync(BG)) {
  fs.writeFileSync(BG,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">#111317</color>\n</resources>\n');
  console.log('아이콘 배경색 → #111317');
}
