/* ══════════════════════════════════════════════════════════
   make-icons.js — 의존성 없이 앱 아이콘 PNG 를 직접 그려 넣는다.
   조리개(아이리스) 모티브 · 배경 #08090B · 링 #E9C08A
   실행:  node scripts/make-icons.js
   ══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');   // Node 내장 (설치할 패키지 없음)

/* ── 최소 PNG 인코더 (zlib stored 블록 사용) ────────────── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── 아이콘 그리기 ─────────────────────────────────────── */
const BG   = [0x08, 0x09, 0x0B];
const GOLD = [0xE9, 0xC0, 0x8A];
const GOLD_DIM = [0x8C, 0x74, 0x53];

/* 정규화 좌표(-1..1)에서 링 모양의 불투명도 */
function shape(x, y, scale) {
  const r = Math.sqrt(x * x + y * y) / scale;
  const ring = (target, half) => {
    const d = Math.abs(r - target);
    return d < half ? 1 : 0;
  };
  if (r < 0.115) return { a: 1, c: GOLD };
  if (ring(0.345, 0.042)) return { a: 1, c: GOLD };
  if (ring(0.63, 0.036)) return { a: 1, c: GOLD_DIM };
  return { a: 0, c: GOLD };
}

function render(size, opts) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3;                                  // 3x3 슈퍼샘플링
  const scale = opts.scale || 1;
  const half = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let ar = 0, ag = 0, ab = 0, aa = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (px + (sx + 0.5) / SS - half) / half;
          const fy = (py + (sy + 0.5) / SS - half) / half;
          const s = shape(fx, fy, scale);

          let r = 0, g = 0, b = 0, a = 0;
          if (opts.background) {
            /* 원형 마스크가 필요하면 반경으로 자른다 */
            const rad = Math.sqrt(fx * fx + fy * fy);
            const inside = opts.round ? rad <= 1 : true;
            if (inside) { r = BG[0]; g = BG[1]; b = BG[2]; a = 1; }
          }
          if (s.a) { r = s.c[0]; g = s.c[1]; b = s.c[2]; a = 1; }
          ar += r; ag += g; ab += b; aa += a;
        }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      rgba[i]     = Math.round(ar / n);
      rgba[i + 1] = Math.round(ag / n);
      rgba[i + 2] = Math.round(ab / n);
      rgba[i + 3] = Math.round((aa / n) * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

/* ── 웹(폰 브라우저·홈 화면 아이콘) ────────────────────── */
const WWW = path.join(__dirname, '..', 'www');
let count = 0, bytes = 0;

[
  ['icon-192.png',      render(192, { background: true, round: false, scale: 0.86 })],
  ['icon-512.png',      render(512, { background: true, round: false, scale: 0.86 })],
  /* 마스커블: 가장자리가 잘려도 되도록 안쪽으로 작게 그린다 */
  ['icon-maskable.png', render(512, { background: true, round: false, scale: 0.52 })]
].forEach(([name, buf]) => {
  fs.writeFileSync(path.join(WWW, name), buf);
  count++; bytes += buf.length;
});
console.log('웹 아이콘 3개 생성');

/* ── 안드로이드 (네이티브 프로젝트가 있을 때만) ────────── */
const RES = path.join(__dirname, '..', 'android/app/src/main/res');
if (!fs.existsSync(RES)) {
  console.log('android 폴더가 없어 네이티브 아이콘은 건너뜁니다 (' +
              count + '개 · ' + (bytes / 1024).toFixed(1) + ' KB)');
  process.exit(0);
}

const DENSITIES = [
  ['mdpi',    48,  108],
  ['hdpi',    72,  162],
  ['xhdpi',   96,  216],
  ['xxhdpi',  144, 324],
  ['xxxhdpi', 192, 432]
];

for (const [d, legacy, fg] of DENSITIES) {
  const dir = path.join(RES, 'mipmap-' + d);
  fs.mkdirSync(dir, { recursive: true });

  const files = [
    ['ic_launcher.png',            render(legacy, { background: true, round: false, scale: 0.86 })],
    ['ic_launcher_round.png',      render(legacy, { background: true, round: true,  scale: 0.86 })],
    ['ic_launcher_foreground.png', render(fg,     { background: false, scale: 0.56 })]
  ];
  for (const [name, buf] of files) {
    fs.writeFileSync(path.join(dir, name), buf);
    count++; bytes += buf.length;
  }
}
console.log(count + '개 아이콘 생성 · ' + (bytes / 1024).toFixed(1) + ' KB');
