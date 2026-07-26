#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════
   render-presets.js — 프리셋을 실제 엔진(gl.js)으로 적용해 PNG 로 뽑습니다.
   앱을 빌드하지 않고도 프리셋이 제대로 먹는지 눈으로 확인할 때 씁니다.

     node scripts/render-presets.js                      샘플 장면에 내장 9종
     node scripts/render-presets.js --image photo.jpg    내 사진에 적용
     node scripts/render-presets.js --xmp my.xmp         라이트룸 프리셋 적용
     node scripts/render-presets.js --amount 50          강도 50%
     node scripts/render-presets.js --out out/           저장 위치

   Chromium(WebGL) 이 필요합니다:  npm i -D playwright
   ══════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www', 'js');

/* ── 인자 ── */
function parseArgs(argv) {
  const a = { out: path.join(ROOT, 'preset-render'), amount: 100, width: 1280, height: 960 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--image') { a.image = v; i++; }
    else if (k === '--xmp') { a.xmp = v; i++; }
    else if (k === '--out') { a.out = path.resolve(v); i++; }
    else if (k === '--chrome') { a.chrome = v; i++; }
    else if (k === '--preset') { a.preset = v; i++; }
    else if (k === '--amount') { a.amount = Number(v); i++; }
    else if (k === '--width') { a.width = Number(v); i++; }
    else if (k === '--height') { a.height = Number(v); i++; }
    else if (k === '--help' || k === '-h') { a.help = true; }
  }
  return a;
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    console.error(
      'playwright 를 찾을 수 없습니다.\n' +
      '  npm i -D playwright\n' +
      '실행 후 다시 시도하세요. (브라우저가 없다면 npx playwright install chromium)'
    );
    process.exit(1);
  }
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function toDataURL(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error('지원하지 않는 이미지 형식: ' + ext);
  return 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(2, -1).join('\n'));
    return;
  }

  const { chromium } = loadPlaywright();
  const sources = ['xmp.js', 'gl.js', 'presets.js', 'sample.js']
    .map((f) => fs.readFileSync(path.join(WWW, f), 'utf8'));

  const imageURL = args.image ? toDataURL(path.resolve(args.image)) : null;
  const xmpText = args.xmp ? fs.readFileSync(path.resolve(args.xmp), 'utf8') : null;

  /* 시스템에 크로미움이 따로 깔려 있으면 그걸 씁니다 (CHROME_PATH 또는 --chrome) */
  const explicitChrome = args.chrome || process.env.CHROME_PATH ||
    (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);

  const browser = await chromium.launch({
    executablePath: explicitChrome || undefined,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('  [브라우저]', m.text()); });

  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">');
  for (const content of sources) await page.addScriptTag({ content });

  const result = await page.evaluate(async (opt) => {
    /* 원본 준비 — 사진이 있으면 사진, 없으면 샘플 장면 */
    let source;
    if (opt.imageURL) {
      source = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('이미지를 열 수 없습니다'));
        im.src = opt.imageURL;
      });
    } else {
      source = SAMPLE.draw(document.createElement('canvas'), opt.width, opt.height);
    }
    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;

    /* 적용할 프리셋 목록 */
    let list = BUILTIN_PRESETS;
    if (opt.xmpText) {
      const parsed = XMP.parse(opt.xmpText);
      if (!parsed) throw new Error('XMP 를 해석하지 못했습니다');
      list = [parsed];
    } else if (opt.preset) {
      list = BUILTIN_PRESETS.filter((p) => p.id === opt.preset || p.name === opt.preset);
      if (!list.length) {
        throw new Error('프리셋을 찾을 수 없습니다: ' + opt.preset +
          ' (사용 가능: ' + BUILTIN_PRESETS.map((p) => p.id + '/' + p.name).join(', ') + ')');
      }
    }

    const probe = document.createElement('canvas').getContext('webgl');
    if (!probe) throw new Error('WebGL 컨텍스트를 만들 수 없습니다');

    const out = [];
    for (const preset of list) {
      const canvas = GL.renderTo(source, preset, opt.amount / 100, sw, sh, false);
      if (!canvas) throw new Error('렌더 실패: ' + preset.name);
      out.push({
        id: preset.id || XMP.safeFileName(preset.name || 'preset'),
        name: preset.name || '이름 없음',
        png: canvas.toDataURL('image/png')
      });
    }

    /* 원본 PNG */
    const oc = document.createElement('canvas');
    oc.width = sw; oc.height = sh;
    oc.getContext('2d').drawImage(source, 0, 0, sw, sh);
    const originalPNG = oc.toDataURL('image/png');

    /* 대조표 — 원본 + 프리셋들 */
    const cells = [{ name: '원본', png: originalPNG }].concat(out);
    const cols = Math.min(5, Math.ceil(Math.sqrt(cells.length * 1.6)));
    const rows = Math.ceil(cells.length / cols);
    const cw = 520;
    const ch = Math.round(cw * sh / sw);
    const label = 42;
    const gap = 10;
    const sheet = document.createElement('canvas');
    sheet.width = cols * cw + gap * (cols + 1);
    sheet.height = rows * (ch + label) + gap * (rows + 1);
    const sc = sheet.getContext('2d');
    sc.fillStyle = '#0B0C0E';
    sc.fillRect(0, 0, sheet.width, sheet.height);

    for (let i = 0; i < cells.length; i++) {
      const cx = gap + (i % cols) * (cw + gap);
      const cy = gap + Math.floor(i / cols) * (ch + label + gap);
      const im = await new Promise((res) => {
        const t = new Image(); t.onload = () => res(t); t.src = cells[i].png;
      });
      sc.drawImage(im, cx, cy, cw, ch);
      sc.fillStyle = '#E8EAED';
      sc.font = '600 24px "WenQuanYi Zen Hei", "Noto Sans CJK KR", sans-serif';
      sc.textBaseline = 'middle';
      sc.fillText(cells[i].name, cx + 4, cy + ch + label / 2);
    }

    return { cells: out, original: originalPNG, sheet: sheet.toDataURL('image/png'), sw, sh };
  }, {
    imageURL,
    xmpText,
    preset: args.preset,
    amount: args.amount,
    width: args.width,
    height: args.height
  });

  await browser.close();

  fs.mkdirSync(args.out, { recursive: true });
  const write = (name, dataURL) => {
    const file = path.join(args.out, name);
    fs.writeFileSync(file, Buffer.from(dataURL.split(',')[1], 'base64'));
    return file;
  };

  write('00-original.png', result.original);
  result.cells.forEach((c, i) => {
    write(String(i + 1).padStart(2, '0') + '-' + c.id + '.png', c.png);
  });
  const sheetFile = write('sheet.png', result.sheet);

  console.log('원본 ' + result.sw + '×' + result.sh + ' · 프리셋 ' + result.cells.length + '종 · 강도 ' + args.amount + '%');
  result.cells.forEach((c) => console.log('  ✓ ' + c.name + ' (' + c.id + ')'));
  console.log('저장 → ' + args.out);
  console.log('대조표 → ' + sheetFile);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
