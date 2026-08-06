/* ══════════════════════════════════════════════════════════
   presets.js — 기본 내장 프리셋 9종
   값은 라이트룸과 같은 단위. XMP.normalize 로 빈 칸을 채웁니다.
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function P(id, name, body) {
    body.id = id; body.name = name; body.source = 'builtin'; body.author = 'LUME';
    return body;
  }

  var BUILTIN = [

    P('bi_golden', '골든아워', {
      basic: { temp: 18, tint: 4, exposure: 0.12, contrast: 12,
               highlights: -22, shadows: 20, whites: 6, blacks: -8,
               texture: 6, clarity: 5, dehaze: 3, vibrance: 16, saturation: -4 },
      curve: { rgb: [[0, 8], [64, 62], [128, 133], [255, 250]],
               r: [[0, 6], [128, 132], [255, 255]],
               g: [[0, 3], [128, 128], [255, 252]],
               b: [[0, 12], [128, 124], [255, 242]],
               param: { hi: 0, lights: 6, darks: 8, sh: 4, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [-6, -8, -14, 12, 0, 0, 0, 0],
             sat: [4, 12, 8, -14, -6, -4, 0, 0],
             lum: [2, 8, 10, -4, 0, -6, 0, 0] },
      grade: { shadow: { h: 38, s: 12, l: 3 }, mid: { h: 42, s: 8, l: 0 },
               high: { h: 46, s: 16, l: 4 }, global: { h: 0, s: 0, l: 0 },
               blending: 60, balance: 10 },
      fx: { vignette: -12, vignetteMid: 55, vignetteFeather: 60,
            grain: 8, grainSize: 22, grainRough: 50, fade: 4, sharpen: 12, monochrome: false }
    }),

    P('bi_cinema', '시네마', {
      basic: { temp: -6, tint: 2, exposure: -0.05, contrast: 22,
               highlights: -30, shadows: 26, whites: -6, blacks: -16,
               texture: 10, clarity: 8, dehaze: 6, vibrance: 8, saturation: -10 },
      curve: { rgb: [[0, 14], [48, 44], [128, 128], [208, 214], [255, 244]],
               r: [[0, 8], [128, 126], [255, 255]],
               g: [[0, 8], [128, 128], [255, 250]],
               b: [[0, 26], [128, 132], [255, 236]],
               param: { hi: -8, lights: 4, darks: -6, sh: 10, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [8, 14, -20, 30, -10, -14, 0, 0],
             sat: [-6, 6, -18, -30, 10, 14, 0, -4],
             lum: [-4, 4, 6, -10, 4, -8, 0, 0] },
      grade: { shadow: { h: 205, s: 24, l: -4 }, mid: { h: 30, s: 8, l: 0 },
               high: { h: 36, s: 18, l: 2 }, global: { h: 0, s: 0, l: 0 },
               blending: 55, balance: -10 },
      fx: { vignette: -22, vignetteMid: 45, vignetteFeather: 65,
            grain: 12, grainSize: 24, grainRough: 50, fade: 8, sharpen: 16, monochrome: false }
    }),

    P('bi_noir', '느와르', {
      basic: { temp: 0, tint: 0, exposure: 0.05, contrast: 26,
               highlights: -22, shadows: 10, whites: 4, blacks: -24,
               texture: 22, clarity: 18, dehaze: 8, vibrance: 0, saturation: -100 },
      curve: { rgb: [[0, 0], [56, 40], [128, 130], [200, 216], [255, 255]],
               param: { hi: 10, lights: 8, darks: -10, sh: -12, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [0, 0, 0, 0, 0, 0, 0, 0],
             sat: [0, 0, 0, 0, 0, 0, 0, 0],
             lum: [8, 6, 10, -14, -8, -22, -6, 4] },
      grade: { shadow: { h: 220, s: 6, l: -2 }, mid: { h: 0, s: 0, l: 0 },
               high: { h: 40, s: 5, l: 2 }, global: { h: 0, s: 0, l: 0 },
               blending: 50, balance: 0 },
      fx: { vignette: -30, vignetteMid: 40, vignetteFeather: 55,
            grain: 22, grainSize: 28, grainRough: 60, fade: 2, sharpen: 24, monochrome: true }
    }),

    P('bi_faded', '빈티지 페이드', {
      basic: { temp: 10, tint: -4, exposure: 0.1, contrast: -10,
               highlights: -14, shadows: 22, whites: -8, blacks: 12,
               texture: -8, clarity: -12, dehaze: -6, vibrance: 10, saturation: -12 },
      curve: { rgb: [[0, 22], [64, 74], [128, 134], [192, 190], [255, 240]],
               r: [[0, 16], [128, 134], [255, 248]],
               g: [[0, 13], [128, 128], [255, 242]],
               b: [[0, 24], [128, 126], [255, 230]],
               param: { hi: -12, lights: -4, darks: 8, sh: 14, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [-10, -6, -18, 24, 6, 8, 0, -8],
             sat: [-8, -2, -16, -18, -8, -6, -4, -8],
             lum: [6, 8, 12, 4, 2, 6, 0, 0] },
      grade: { shadow: { h: 60, s: 14, l: 6 }, mid: { h: 44, s: 6, l: 2 },
               high: { h: 52, s: 12, l: 4 }, global: { h: 0, s: 0, l: 0 },
               blending: 70, balance: 20 },
      fx: { vignette: -8, vignetteMid: 60, vignetteFeather: 70,
            grain: 20, grainSize: 30, grainRough: 45, fade: 13, sharpen: 6, monochrome: false }
    }),

    P('bi_mute', '모던 뮤트', {
      basic: { temp: -4, tint: 2, exposure: 0.08, contrast: 8,
               highlights: -20, shadows: 10, whites: 4, blacks: -10,
               texture: 8, clarity: -4, dehaze: 2, vibrance: -4, saturation: -8 },
      curve: { rgb: [[0, 5], [72, 72], [128, 130], [255, 246]],
               param: { hi: -6, lights: 2, darks: 2, sh: 4, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [4, 6, -12, 18, 8, 4, 0, 0],
             sat: [-10, -6, -18, -22, -12, -10, -6, -8],
             lum: [4, 6, 10, 6, 4, 2, 0, 0] },
      grade: { shadow: { h: 200, s: 8, l: 2 }, mid: { h: 30, s: 4, l: 0 },
               high: { h: 40, s: 6, l: 2 }, global: { h: 0, s: 0, l: 0 },
               blending: 50, balance: 0 },
      fx: { vignette: -6, vignetteMid: 60, vignetteFeather: 65,
            grain: 6, grainSize: 20, grainRough: 50, fade: 6, sharpen: 10, monochrome: false }
    }),

    P('bi_crisp', '청량', {
      basic: { temp: -14, tint: -2, exposure: 0.15, contrast: 16,
               highlights: -16, shadows: 14, whites: 10, blacks: -12,
               texture: 14, clarity: 12, dehaze: 12, vibrance: 22, saturation: 0 },
      curve: { rgb: [[0, 4], [64, 60], [128, 132], [255, 252]],
               b: [[0, 6], [128, 132], [255, 252]],
               param: { hi: 6, lights: 6, darks: -4, sh: -6, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [0, -4, -10, 20, -8, -6, 0, 0],
             sat: [0, 4, -8, -6, 18, 22, 6, 0],
             lum: [0, 2, 6, 6, 6, 8, 0, 0] },
      grade: { shadow: { h: 210, s: 10, l: 0 }, mid: { h: 190, s: 4, l: 2 },
               high: { h: 200, s: 8, l: 4 }, global: { h: 0, s: 0, l: 0 },
               blending: 50, balance: -6 },
      fx: { vignette: 0, vignetteMid: 60, vignetteFeather: 60,
            grain: 0, grainSize: 25, grainRough: 50, fade: 0, sharpen: 22, monochrome: false }
    }),

    P('bi_cafe', '카페 브라운', {
      basic: { temp: 14, tint: 6, exposure: -0.08, contrast: 12,
               highlights: -26, shadows: 12, whites: -4, blacks: -14,
               texture: 6, clarity: 4, dehaze: 4, vibrance: 8, saturation: -10 },
      curve: { rgb: [[0, 8], [64, 64], [128, 130], [255, 246]],
               r: [[0, 6], [128, 134], [255, 252]],
               g: [[0, 5], [128, 126], [255, 246]],
               b: [[0, 9], [128, 118], [255, 232]],
               param: { hi: -6, lights: 0, darks: 4, sh: 6, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [-4, -12, -22, 26, 0, 0, 0, 0],
             sat: [-4, 10, -12, -24, -14, -12, -8, -6],
             lum: [-4, 2, 6, -8, -4, -10, 0, 0] },
      grade: { shadow: { h: 30, s: 16, l: 2 }, mid: { h: 34, s: 10, l: 0 },
               high: { h: 44, s: 10, l: 2 }, global: { h: 0, s: 0, l: 0 },
               blending: 65, balance: 14 },
      fx: { vignette: -16, vignetteMid: 50, vignetteFeather: 60,
            grain: 14, grainSize: 26, grainRough: 50, fade: 5, sharpen: 10, monochrome: false }
    }),

    P('bi_neon', '네온 나이트', {
      basic: { temp: -10, tint: 10, exposure: -0.12, contrast: 26,
               highlights: -34, shadows: 30, whites: -4, blacks: -22,
               texture: 12, clarity: 14, dehaze: 10, vibrance: 26, saturation: 8 },
      curve: { rgb: [[0, 12], [48, 38], [128, 128], [206, 216], [255, 248]],
               r: [[0, 10], [128, 130], [255, 255]],
               g: [[0, 6], [128, 124], [255, 246]],
               b: [[0, 22], [128, 136], [255, 255]],
               param: { hi: 8, lights: 4, darks: -12, sh: 6, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [10, 0, -16, -20, -14, -8, 6, 4],
             sat: [16, 6, -20, -30, 24, 30, 26, 20],
             lum: [-6, -4, -8, -14, 4, -6, 4, 2] },
      grade: { shadow: { h: 250, s: 26, l: -6 }, mid: { h: 300, s: 8, l: 0 },
               high: { h: 190, s: 20, l: 2 }, global: { h: 0, s: 0, l: 0 },
               blending: 45, balance: -14 },
      fx: { vignette: -26, vignetteMid: 42, vignetteFeather: 70,
            grain: 16, grainSize: 24, grainRough: 55, fade: 4, sharpen: 18, monochrome: false }
    }),

    P('bi_soft', '소프트 스킨', {
      basic: { temp: 6, tint: 4, exposure: 0.16, contrast: -4,
               highlights: -24, shadows: 14, whites: 6, blacks: -2,
               texture: -18, clarity: -14, dehaze: 0, vibrance: 14, saturation: -4 },
      curve: { rgb: [[0, 6], [72, 76], [160, 166], [255, 250]],
               param: { hi: -10, lights: 4, darks: 4, sh: 8, splitSh: 25, splitMid: 50, splitHi: 75 } },
      hsl: { hue: [-8, -10, -6, 10, 0, 0, 0, -6],
             sat: [-8, -4, -14, -20, -8, -6, 0, -6],
             lum: [8, 12, 10, 0, 0, -4, 0, 4] },
      grade: { shadow: { h: 20, s: 8, l: 4 }, mid: { h: 28, s: 6, l: 2 },
               high: { h: 40, s: 10, l: 4 }, global: { h: 0, s: 0, l: 0 },
               blending: 60, balance: 8 },
      fx: { vignette: -10, vignetteMid: 60, vignetteFeather: 70,
            grain: 4, grainSize: 20, grainRough: 45, fade: 4, sharpen: 4, monochrome: false }
    })
  ];

  var base = BUILTIN.map(function (p) { return XMP.normalize(p); });
  var trend = [
    { id: 'bi_clear_air', name: '청량 에어리', from: 5,
      basic: { temp: -10, tint: 1, exposure: 0.22, contrast: 6, highlights: -28, shadows: 24, whites: 14, blacks: -8, clarity: -2, dehaze: 4, vibrance: 15, saturation: -3 },
      hsl: { hue: [0,-4,-12,18,-12,-8,0,0], sat: [-5,0,-18,-8,8,18,-5,-4], lum: [8,12,14,8,10,16,4,6] } },
    { id: 'bi_pinterest', name: '핀터 에디토리얼', from: 4,
      basic: { temp: 5, tint: 2, exposure: 0.12, contrast: -8, highlights: -30, shadows: 22, whites: -8, blacks: 10, clarity: -8, dehaze: -3, vibrance: -8, saturation: -12 },
      hsl: { hue: [-4,-8,-18,20,8,4,0,-4], sat: [-12,-10,-26,-30,-22,-18,-12,-14], lum: [8,12,14,8,7,5,6,8] } },
    { id: 'bi_quiet_luxury', name: '콰이어트 럭셔리', from: 6,
      basic: { temp: 8, tint: 2, exposure: -0.02, contrast: 14, highlights: -32, shadows: 16, whites: -8, blacks: -15, clarity: 2, dehaze: 3, vibrance: -9, saturation: -10 },
      hsl: { hue: [-4,-10,-20,28,10,4,0,-5], sat: [-10,-2,-28,-34,-24,-20,-16,-14], lum: [2,8,10,-5,-4,-8,0,2] } },
    { id: 'bi_cool_analog', name: '쿨 아날로그', from: 1,
      basic: { temp: -7, tint: 3, exposure: 0.08, contrast: 5, highlights: -35, shadows: 24, whites: -10, blacks: 6, clarity: -7, dehaze: -2, vibrance: 3, saturation: -8 },
      hsl: { hue: [4,4,-14,22,-8,-8,0,-2], sat: [-5,2,-20,-25,-8,2,-8,-8], lum: [5,10,12,4,4,8,3,4] } },
    { id: 'bi_cotton_skin', name: '코튼 스킨', from: 8,
      basic: { temp: 3, tint: 3, exposure: 0.24, contrast: -10, highlights: -28, shadows: 20, whites: 8, blacks: 4, texture: -12, clarity: -16, dehaze: -2, vibrance: 6, saturation: -6 },
      hsl: { hue: [-6,-8,-8,8,0,0,0,-4], sat: [-10,-8,-18,-20,-12,-10,-8,-8], lum: [14,18,10,4,4,4,5,10] } },
    { id: 'bi_jeju_blue', name: '제주 블루', from: 5,
      basic: { temp: -12, tint: -1, exposure: 0.16, contrast: 12, highlights: -24, shadows: 17, whites: 11, blacks: -10, clarity: 5, dehaze: 8, vibrance: 18, saturation: -2 },
      hsl: { hue: [0,-4,-18,26,-20,-12,0,0], sat: [-5,-2,-30,-15,22,30,-5,-5], lum: [2,8,12,8,10,16,2,2] } },
    { id: 'bi_seoul_night', name: '서울 나이트', from: 7,
      basic: { temp: -8, tint: 12, exposure: -0.10, contrast: 24, highlights: -38, shadows: 28, whites: -5, blacks: -20, clarity: 10, dehaze: 8, vibrance: 22, saturation: 4 } },
    { id: 'bi_cream_cafe', name: '크림 카페', from: 6,
      basic: { temp: 11, tint: 4, exposure: 0.10, contrast: -2, highlights: -34, shadows: 20, whites: -8, blacks: 5, clarity: -6, dehaze: -2, vibrance: -2, saturation: -9 } },
    { id: 'bi_flash_diary', name: '플래시 다이어리', from: 0,
      basic: { temp: -2, tint: 4, exposure: 0.28, contrast: 22, highlights: -16, shadows: 8, whites: 22, blacks: -22, texture: 12, clarity: 8, dehaze: 4, vibrance: 12, saturation: 3 },
      hsl: { hue: [0,-2,-8,12,-6,-4,0,0], sat: [8,8,-8,-8,8,10,5,5], lum: [10,14,4,-3,2,4,4,8] } },
    { id: 'bi_digicam', name: '빈티지 디카', from: 3,
      basic: { temp: -3, tint: 5, exposure: 0.10, contrast: 18, highlights: -12, shadows: 12, whites: 12, blacks: -8, texture: 8, clarity: 3, dehaze: 1, vibrance: 15, saturation: 2 },
      hsl: { hue: [6,0,-12,18,-8,-6,2,2], sat: [8,10,-8,-12,8,12,10,8], lum: [5,8,8,2,4,5,2,4] } }
  ];

  global.BUILTIN_PRESETS = trend.map(function (spec) {
    var p = JSON.parse(JSON.stringify(base[spec.from]));
    p.id = spec.id;
    p.name = spec.name;
    p.source = 'builtin';
    p.author = 'LUME';
    if (spec.basic) Object.assign(p.basic, spec.basic);
    if (spec.hsl) {
      if (spec.hsl.hue) p.hsl.hue = spec.hsl.hue;
      if (spec.hsl.sat) p.hsl.sat = spec.hsl.sat;
      if (spec.hsl.lum) p.hsl.lum = spec.hsl.lum;
    }
    var normalized = XMP.normalize(p);
    normalized.lume = LumeEffects.normalize(p.lume);
    return normalized;
  });
})(window);
