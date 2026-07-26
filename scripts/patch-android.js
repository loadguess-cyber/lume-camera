/* ══════════════════════════════════════════════════════════
   patch-android.js
   `npx cap add android` 가 만든 네이티브 프로젝트에
   카메라 앱에 필요한 권한과 설정을 덧붙인다. 여러 번 실행해도 안전.
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

/* 1. 권한 ------------------------------------------------ */
const PERMS = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  '<uses-feature android:name="android.hardware.camera" android:required="true" />',
  '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
];

const missing = PERMS.filter(p => {
  const key = (p.match(/android:name="([^"]+)"/) || [])[1];
  return key && xml.indexOf('"' + key + '"') === -1;
});

if (missing.length) {
  xml = xml.replace('</manifest>', '\n    ' + missing.join('\n    ') + '\n</manifest>');
  changed = true;
  console.log('권한 ' + missing.length + '개 추가');
}

/* 2. 세로 고정 + 화면 꺼짐 방지 -------------------------- */
if (xml.indexOf('android:screenOrientation') === -1) {
  xml = xml.replace(
    /(<activity[^>]*android:name="\.MainActivity")/,
    '$1\n            android:screenOrientation="portrait"\n            android:keepScreenOn="true"'
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
  s = s.replace(/(<string name="app_name">)[^<]*(<\/string>)/, '$1LUME$2');
  s = s.replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, '$1LUME$2');
  if (s !== before) { fs.writeFileSync(STRINGS, s); console.log('앱 이름 → LUME'); }
}

/* 4. 아이콘 배경색 --------------------------------------- */
const BG = path.join(ROOT, 'android/app/src/main/res/values/ic_launcher_background.xml');
if (fs.existsSync(BG)) {
  fs.writeFileSync(BG,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">#08090B</color>\n</resources>\n');
  console.log('아이콘 배경색 → #08090B');
}
