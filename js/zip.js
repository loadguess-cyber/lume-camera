/* ══════════════════════════════════════════════════════════
   zip.js — 최소 ZIP 작성기 (압축 없이 담기만, store 방식)

   여러 장을 한 번에 내려받을 때 씁니다. JPEG·PNG 는 이미 압축된
   형식이라 deflate 를 걸어도 거의 줄지 않습니다. 압축을 빼면
   외부 라이브러리 없이 100줄로 끝나고 속도도 훨씬 빠릅니다.
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* CRC32 — ZIP 규격이 요구합니다 */
  var TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* 파일 이름은 UTF-8 로 넣고 플래그에 표시합니다 (한글 이름 대응) */
  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  /* MS-DOS 형식 날짜·시각 */
  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xFFFF;
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  }

  function w16(view, off, v) { view.setUint16(off, v, true); }
  function w32(view, off, v) { view.setUint32(off, v, true); }

  /* files: [{ name: '이름.jpg', data: Uint8Array|ArrayBuffer }] → Blob */
  function build(files, opts) {
    opts = opts || {};
    var now = opts.date || new Date();
    var time = dosTime(now), date = dosDate(now);

    var parts = [];       /* Blob 조각들 */
    var central = [];     /* 중앙 디렉터리 항목 */
    var offset = 0;

    files.forEach(function (f) {
      var data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      var name = utf8(f.name);
      var sum = crc32(data);

      /* 로컬 파일 헤더 (30바이트 + 이름) */
      var lh = new ArrayBuffer(30);
      var lv = new DataView(lh);
      w32(lv, 0, 0x04034B50);
      w16(lv, 4, 20);            /* 필요 버전 */
      w16(lv, 6, 0x0800);        /* 이름이 UTF-8 임을 표시 */
      w16(lv, 8, 0);             /* 압축 없음 */
      w16(lv, 10, time);
      w16(lv, 12, date);
      w32(lv, 14, sum);
      w32(lv, 18, data.length);  /* 압축 크기 = 원본 크기 */
      w32(lv, 22, data.length);
      w16(lv, 26, name.length);
      w16(lv, 28, 0);            /* 부가 필드 없음 */

      parts.push(lh, name, data);

      /* 중앙 디렉터리 항목 (46바이트 + 이름) */
      var ch = new ArrayBuffer(46);
      var cv = new DataView(ch);
      w32(cv, 0, 0x02014B50);
      w16(cv, 4, 20);            /* 만든 버전 */
      w16(cv, 6, 20);
      w16(cv, 8, 0x0800);
      w16(cv, 10, 0);
      w16(cv, 12, time);
      w16(cv, 14, date);
      w32(cv, 16, sum);
      w32(cv, 20, data.length);
      w32(cv, 24, data.length);
      w16(cv, 28, name.length);
      w16(cv, 30, 0);            /* 부가 */
      w16(cv, 32, 0);            /* 주석 */
      w16(cv, 34, 0);            /* 디스크 번호 */
      w16(cv, 36, 0);            /* 내부 속성 */
      w32(cv, 38, 0);            /* 외부 속성 */
      w32(cv, 42, offset);       /* 로컬 헤더 위치 */

      central.push(ch, name);
      offset += 30 + name.length + data.length;
    });

    var centralStart = offset;
    var centralSize = central.reduce(function (n, p) {
      return n + (p.byteLength || p.length);
    }, 0);

    /* 끝 레코드 */
    var eh = new ArrayBuffer(22);
    var ev = new DataView(eh);
    w32(ev, 0, 0x06054B50);
    w16(ev, 4, 0);
    w16(ev, 6, 0);
    w16(ev, 8, files.length);
    w16(ev, 10, files.length);
    w32(ev, 12, centralSize);
    w32(ev, 16, centralStart);
    w16(ev, 20, 0);

    return new Blob(parts.concat(central, [eh]), { type: 'application/zip' });
  }

  /* Blob 목록을 바로 zip 으로 (이름 중복은 뒤에 번호를 붙입니다) */
  function fromBlobs(items) {
    var used = {};
    return Promise.all(items.map(function (it) {
      return it.blob.arrayBuffer().then(function (buf) {
        var name = it.name;
        if (used[name]) {
          var dot = name.lastIndexOf('.');
          var stem = dot > 0 ? name.slice(0, dot) : name;
          var ext = dot > 0 ? name.slice(dot) : '';
          name = stem + '_' + (used[it.name] + 1) + ext;
        }
        used[it.name] = (used[it.name] || 0) + 1;
        return { name: name, data: new Uint8Array(buf) };
      });
    })).then(function (files) { return build(files); });
  }

  global.Zip = { build: build, fromBlobs: fromBlobs, crc32: crc32 };
})(window);
