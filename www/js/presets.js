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

  global.BUILTIN_PRESETS = BUILTIN.map(function (p) { return XMP.normalize(p); });
})(window);
