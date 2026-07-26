/* ══════════════════════════════════════════════════════════
   xmp.js — 프리셋 데이터 모델 · 라이트룸 XMP 읽기/쓰기
   ══════════════════════════════════════════════════════════
   모든 값은 라이트룸과 같은 단위를 씁니다.
     노출  -5 ~ +5 (EV)   나머지 대부분 -100 ~ +100
     커브 점 [x,y] 0~255   HSL 8채널 -100~100
   ══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* 8개 색상 채널 (라이트룸과 동일한 순서) */
  var HSL_KEYS  = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];
  var HSL_NAMES = ['빨강', '주황', '노랑', '초록', '청록', '파랑', '보라', '자홍'];
  /* 화면 표시용 대표 색 (실제 밴드 중심 hue 는 gl.js 와 맞춤) */
  var HSL_HUES  = [0, 30, 55, 110, 180, 225, 275, 320];

  function neutral() {
    return {
      id: null,
      name: '새 프리셋',
      author: '',
      created: Date.now(),
      source: 'app',            // app · xmp · builtin
      basic: {
        temp: 0, tint: 0, exposure: 0, contrast: 0,
        highlights: 0, shadows: 0, whites: 0, blacks: 0,
        texture: 0, clarity: 0, dehaze: 0,
        vibrance: 0, saturation: 0
      },
      curve: {
        rgb: [[0, 0], [255, 255]],
        r:   [[0, 0], [255, 255]],
        g:   [[0, 0], [255, 255]],
        b:   [[0, 0], [255, 255]],
        param: { hi: 0, lights: 0, darks: 0, sh: 0, splitSh: 25, splitMid: 50, splitHi: 75 }
      },
      hsl: {
        hue: [0, 0, 0, 0, 0, 0, 0, 0],
        sat: [0, 0, 0, 0, 0, 0, 0, 0],
        lum: [0, 0, 0, 0, 0, 0, 0, 0]
      },
      grade: {
        shadow: { h: 0, s: 0, l: 0 },
        mid:    { h: 0, s: 0, l: 0 },
        high:   { h: 0, s: 0, l: 0 },
        global: { h: 0, s: 0, l: 0 },
        blending: 50, balance: 0
      },
      fx: {
        vignette: 0, vignetteMid: 50, vignetteFeather: 50,
        grain: 0, grainSize: 25, grainRough: 50,
        fade: 0, sharpen: 0, monochrome: false
      }
    };
  }

  /* 빠진 필드를 기본값으로 채운다 (구버전 저장본 호환) */
  function normalize(p) {
    var base = neutral();
    if (!p || typeof p !== 'object') return base;
    var out = base;
    ['id', 'name', 'author', 'created', 'source'].forEach(function (k) {
      if (p[k] !== undefined && p[k] !== null) out[k] = p[k];
    });
    ['basic', 'fx'].forEach(function (grp) {
      if (p[grp]) Object.keys(base[grp]).forEach(function (k) {
        if (typeof p[grp][k] === typeof base[grp][k]) out[grp][k] = p[grp][k];
      });
    });
    if (p.curve) {
      ['rgb', 'r', 'g', 'b'].forEach(function (k) {
        if (Array.isArray(p.curve[k]) && p.curve[k].length >= 2) out.curve[k] = p.curve[k];
      });
      if (p.curve.param) Object.keys(base.curve.param).forEach(function (k) {
        if (typeof p.curve.param[k] === 'number') out.curve.param[k] = p.curve.param[k];
      });
    }
    if (p.hsl) ['hue', 'sat', 'lum'].forEach(function (k) {
      if (Array.isArray(p.hsl[k])) for (var i = 0; i < 8; i++)
        out.hsl[k][i] = +p.hsl[k][i] || 0;
    });
    if (p.grade) {
      ['shadow', 'mid', 'high', 'global'].forEach(function (z) {
        if (p.grade[z]) ['h', 's', 'l'].forEach(function (k) {
          if (typeof p.grade[z][k] === 'number') out.grade[z][k] = p.grade[z][k];
        });
      });
      if (typeof p.grade.blending === 'number') out.grade.blending = p.grade.blending;
      if (typeof p.grade.balance === 'number') out.grade.balance = p.grade.balance;
    }
    return out;
  }

  /* 기본값과 같은지 (= 아무 보정 없음) */
  function isNeutral(p) {
    return JSON.stringify(stripMeta(p)) === JSON.stringify(stripMeta(neutral()));
  }
  function stripMeta(p) {
    var c = JSON.parse(JSON.stringify(p));
    delete c.id; delete c.name; delete c.author; delete c.created; delete c.source;
    return c;
  }

  /* ══════════════ XMP 읽기 ══════════════ */

  /* crs: 속성과 crs: 자식 요소를 모두 평평한 map 으로 모은다 */
  function flatten(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XMP 형식을 읽을 수 없습니다');
    var map = {};
    var all = doc.getElementsByTagName('*');

    for (var i = 0; i < all.length; i++) {
      var el = all[i];

      /* 속성형:  crs:Exposure2012="+0.35" */
      for (var a = 0; a < el.attributes.length; a++) {
        var at = el.attributes[a];
        var an = at.name.indexOf(':') >= 0 ? at.name.split(':').pop() : at.name;
        if (at.name.indexOf('crs:') === 0) map[an] = at.value;
        /* LUME 전용 값 (라이트룸은 무시하는 자체 네임스페이스) */
        else if (at.name.indexOf('lume:') === 0) map['LUME_' + an] = at.value;
      }

      /* 요소형:  <crs:Exposure2012>+0.35</crs:Exposure2012> */
      if (el.nodeName.indexOf('crs:') === 0) {
        var name = el.nodeName.split(':').pop();
        var seq = el.getElementsByTagName('*');
        var items = [];
        for (var s = 0; s < seq.length; s++) {
          if (seq[s].nodeName.split(':').pop() === 'li') items.push(seq[s].textContent.trim());
        }
        if (items.length) map[name] = items;
        else {
          var t = el.textContent.trim();
          if (t && !el.children.length) map[name] = t;
        }
      }
    }
    return map;
  }

  function num(map, key, dflt) {
    var v = map[key];
    if (v === undefined || v === null || Array.isArray(v)) return dflt;
    var n = parseFloat(String(v).replace(/^\+/, ''));
    return isFinite(n) ? n : dflt;
  }
  function bool(map, key, dflt) {
    var v = map[key];
    if (v === undefined) return dflt;
    return String(v).toLowerCase() === 'true';
  }
  function points(map, key) {
    var v = map[key];
    if (!Array.isArray(v) || v.length < 2) return null;
    var pts = [];
    for (var i = 0; i < v.length; i++) {
      var m = String(v[i]).split(',');
      if (m.length < 2) continue;
      var x = parseFloat(m[0]), y = parseFloat(m[1]);
      if (isFinite(x) && isFinite(y)) pts.push([x, y]);
    }
    pts.sort(function (a, b) { return a[0] - b[0]; });
    return pts.length >= 2 ? pts : null;
  }

  /* 절대 색온도(K) → -100~100 상대값 */
  function kelvinToRel(k) {
    if (!isFinite(k)) return 0;
    var d = k - 5500;
    var r = d >= 0 ? d / 60 : d / 30;   // 차가운 쪽이 폭이 넓다
    return Math.max(-100, Math.min(100, r));
  }

  function parse(xmlText, fallbackName) {
    var m = flatten(xmlText);
    var p = neutral();
    p.source = 'xmp';
    p.name = (m.Name && !Array.isArray(m.Name) ? m.Name : null) ||
             (Array.isArray(m.Name) ? m.Name[0] : null) ||
             fallbackName || '가져온 프리셋';
    p.author = m.Creator || m.Author || '';

    var b = p.basic;
    /* 화이트밸런스 — 프리셋은 보통 Incremental(상대값)을 쓴다 */
    if (m.IncrementalTemperature !== undefined) b.temp = num(m, 'IncrementalTemperature', 0);
    else if (m.Temperature !== undefined) b.temp = kelvinToRel(num(m, 'Temperature', 5500));
    if (m.IncrementalTint !== undefined) b.tint = num(m, 'IncrementalTint', 0);
    else if (m.Tint !== undefined) b.tint = num(m, 'Tint', 0) * (100 / 150);

    b.exposure   = num(m, 'Exposure2012',   num(m, 'Exposure', 0));
    b.contrast   = num(m, 'Contrast2012',   num(m, 'Contrast', 0));
    b.highlights = num(m, 'Highlights2012', num(m, 'HighlightRecovery', 0));
    b.shadows    = num(m, 'Shadows2012',    num(m, 'FillLight', 0));
    b.whites     = num(m, 'Whites2012', 0);
    b.blacks     = num(m, 'Blacks2012',     num(m, 'Blacks', 0));
    b.texture    = num(m, 'Texture', 0);
    b.clarity    = num(m, 'Clarity2012',    num(m, 'Clarity', 0));
    b.dehaze     = num(m, 'Dehaze', 0);
    b.vibrance   = num(m, 'Vibrance', 0);
    b.saturation = num(m, 'Saturation', 0);

    /* 커브 */
    var cr = points(m, 'ToneCurvePV2012') || points(m, 'ToneCurve');
    if (cr) p.curve.rgb = cr;
    var cR = points(m, 'ToneCurvePV2012Red');   if (cR) p.curve.r = cR;
    var cG = points(m, 'ToneCurvePV2012Green'); if (cG) p.curve.g = cG;
    var cB = points(m, 'ToneCurvePV2012Blue');  if (cB) p.curve.b = cB;

    var pp = p.curve.param;
    pp.hi      = num(m, 'ParametricHighlights', 0);
    pp.lights  = num(m, 'ParametricLights', 0);
    pp.darks   = num(m, 'ParametricDarks', 0);
    pp.sh      = num(m, 'ParametricShadows', 0);
    pp.splitSh = num(m, 'ParametricShadowSplit', 25);
    pp.splitMid= num(m, 'ParametricMidtoneSplit', 50);
    pp.splitHi = num(m, 'ParametricHighlightSplit', 75);

    /* HSL */
    for (var i = 0; i < 8; i++) {
      var k = HSL_KEYS[i];
      p.hsl.hue[i] = num(m, 'HueAdjustment' + k, 0);
      p.hsl.sat[i] = num(m, 'SaturationAdjustment' + k, 0);
      p.hsl.lum[i] = num(m, 'LuminanceAdjustment' + k, 0);
    }

    /* 컬러 그레이딩 (신형 ColorGrade* + 구형 SplitToning*) */
    var g = p.grade;
    g.shadow.h = num(m, 'SplitToningShadowHue', 0);
    g.shadow.s = num(m, 'SplitToningShadowSaturation', 0);
    g.shadow.l = num(m, 'ColorGradeShadowLum', 0);
    g.high.h   = num(m, 'SplitToningHighlightHue', 0);
    g.high.s   = num(m, 'SplitToningHighlightSaturation', 0);
    g.high.l   = num(m, 'ColorGradeHighlightLum', 0);
    g.mid.h    = num(m, 'ColorGradeMidtoneHue', 0);
    g.mid.s    = num(m, 'ColorGradeMidtoneSat', 0);
    g.mid.l    = num(m, 'ColorGradeMidtoneLum', 0);
    g.global.h = num(m, 'ColorGradeGlobalHue', 0);
    g.global.s = num(m, 'ColorGradeGlobalSat', 0);
    g.global.l = num(m, 'ColorGradeGlobalLum', 0);
    g.blending = num(m, 'ColorGradeBlending', 50);
    g.balance  = num(m, 'ColorGradeBalance', num(m, 'SplitToningBalance', 0));

    /* 효과 */
    var f = p.fx;
    f.vignette        = num(m, 'PostCropVignetteAmount', 0);
    f.vignetteMid     = num(m, 'PostCropVignetteMidpoint', 50);
    f.vignetteFeather = num(m, 'PostCropVignetteFeather', 50);
    f.grain           = num(m, 'GrainAmount', 0);
    f.grainSize       = num(m, 'GrainSize', 25);
    f.grainRough      = num(m, 'GrainFrequency', 50);
    f.sharpen         = num(m, 'Sharpness', 0) / 150 * 100;
    f.monochrome      = bool(m, 'ConvertToGrayscale', false);
    f.fade            = num(m, 'LUME_Fade', 0);   // 라이트룸에 없는 LUME 자체 항목

    return p;
  }

  /* ══════════════ XMP 쓰기 ══════════════ */

  function f2(v) { var n = Math.round(v * 100) / 100; return (n > 0 ? '+' : '') + n; }
  function i0(v) { var n = Math.round(v); return (n > 0 ? '+' : '') + n; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function seq(tag, pts) {
    var li = pts.map(function (p) {
      return '     <rdf:li>' + Math.round(p[0]) + ', ' + Math.round(p[1]) + '</rdf:li>';
    }).join('\n');
    return '   <crs:' + tag + '>\n    <rdf:Seq>\n' + li + '\n    </rdf:Seq>\n   </crs:' + tag + '>';
  }

  function serialize(p) {
    p = normalize(p);
    var b = p.basic, g = p.grade, f = p.fx, pp = p.curve.param;
    var A = [];
    A.push('crs:PresetType="Normal"');
    A.push('crs:Cluster=""');
    A.push('crs:UUID="' + (p.id || 'LUME' + Date.now()).toUpperCase().replace(/[^A-Z0-9]/g, '') + '"');
    A.push('crs:SupportsAmount="True"');
    A.push('crs:SupportsColor="True"');
    A.push('crs:SupportsMonochrome="True"');
    A.push('crs:SupportsHighDynamicRange="True"');
    A.push('crs:SupportsNormalDynamicRange="True"');
    A.push('crs:SupportsSceneReferred="True"');
    A.push('crs:SupportsOutputReferred="True"');
    A.push('crs:CameraModelRestriction=""');
    A.push('crs:Copyright=""');
    A.push('crs:ContactInfo=""');
    A.push('crs:Version="15.0"');
    A.push('crs:ProcessVersion="15.4"');

    A.push('crs:IncrementalTemperature="' + i0(b.temp) + '"');
    A.push('crs:IncrementalTint="' + i0(b.tint) + '"');
    A.push('crs:Exposure2012="' + f2(b.exposure) + '"');
    A.push('crs:Contrast2012="' + i0(b.contrast) + '"');
    A.push('crs:Highlights2012="' + i0(b.highlights) + '"');
    A.push('crs:Shadows2012="' + i0(b.shadows) + '"');
    A.push('crs:Whites2012="' + i0(b.whites) + '"');
    A.push('crs:Blacks2012="' + i0(b.blacks) + '"');
    A.push('crs:Texture="' + i0(b.texture) + '"');
    A.push('crs:Clarity2012="' + i0(b.clarity) + '"');
    A.push('crs:Dehaze="' + i0(b.dehaze) + '"');
    A.push('crs:Vibrance="' + i0(b.vibrance) + '"');
    A.push('crs:Saturation="' + i0(b.saturation) + '"');

    A.push('crs:ParametricShadows="' + i0(pp.sh) + '"');
    A.push('crs:ParametricDarks="' + i0(pp.darks) + '"');
    A.push('crs:ParametricLights="' + i0(pp.lights) + '"');
    A.push('crs:ParametricHighlights="' + i0(pp.hi) + '"');
    A.push('crs:ParametricShadowSplit="' + Math.round(pp.splitSh) + '"');
    A.push('crs:ParametricMidtoneSplit="' + Math.round(pp.splitMid) + '"');
    A.push('crs:ParametricHighlightSplit="' + Math.round(pp.splitHi) + '"');

    for (var i = 0; i < 8; i++) {
      A.push('crs:HueAdjustment' + HSL_KEYS[i] + '="' + i0(p.hsl.hue[i]) + '"');
    }
    for (i = 0; i < 8; i++) {
      A.push('crs:SaturationAdjustment' + HSL_KEYS[i] + '="' + i0(p.hsl.sat[i]) + '"');
    }
    for (i = 0; i < 8; i++) {
      A.push('crs:LuminanceAdjustment' + HSL_KEYS[i] + '="' + i0(p.hsl.lum[i]) + '"');
    }

    A.push('crs:SplitToningShadowHue="' + Math.round(g.shadow.h) + '"');
    A.push('crs:SplitToningShadowSaturation="' + Math.round(g.shadow.s) + '"');
    A.push('crs:SplitToningHighlightHue="' + Math.round(g.high.h) + '"');
    A.push('crs:SplitToningHighlightSaturation="' + Math.round(g.high.s) + '"');
    A.push('crs:SplitToningBalance="' + i0(g.balance) + '"');
    A.push('crs:ColorGradeMidtoneHue="' + Math.round(g.mid.h) + '"');
    A.push('crs:ColorGradeMidtoneSat="' + Math.round(g.mid.s) + '"');
    A.push('crs:ColorGradeMidtoneLum="' + i0(g.mid.l) + '"');
    A.push('crs:ColorGradeShadowLum="' + i0(g.shadow.l) + '"');
    A.push('crs:ColorGradeHighlightLum="' + i0(g.high.l) + '"');
    A.push('crs:ColorGradeGlobalHue="' + Math.round(g.global.h) + '"');
    A.push('crs:ColorGradeGlobalSat="' + Math.round(g.global.s) + '"');
    A.push('crs:ColorGradeGlobalLum="' + i0(g.global.l) + '"');
    A.push('crs:ColorGradeBlending="' + Math.round(g.blending) + '"');
    A.push('crs:ColorGradeBalance="' + i0(g.balance) + '"');

    A.push('crs:PostCropVignetteAmount="' + i0(f.vignette) + '"');
    A.push('crs:PostCropVignetteMidpoint="' + Math.round(f.vignetteMid) + '"');
    A.push('crs:PostCropVignetteFeather="' + Math.round(f.vignetteFeather) + '"');
    A.push('crs:PostCropVignetteRoundness="0"');
    A.push('crs:PostCropVignetteStyle="1"');
    A.push('crs:GrainAmount="' + Math.round(f.grain) + '"');
    A.push('crs:GrainSize="' + Math.round(f.grainSize) + '"');
    A.push('crs:GrainFrequency="' + Math.round(f.grainRough) + '"');
    A.push('crs:Sharpness="' + Math.round(f.sharpen * 1.5) + '"');
    A.push('crs:ConvertToGrayscale="' + (f.monochrome ? 'True' : 'False') + '"');
    A.push('crs:HasSettings="True"');
    A.push('lume:Fade="' + Math.round(f.fade) + '"');

    var attrs = A.map(function (s) { return '   ' + s; }).join('\n');

    return '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="LUME Camera">\n' +
      ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
      '  <rdf:Description rdf:about=""\n' +
      '   xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"\n' +
      '   xmlns:lume="https://lume.app/ns/1.0/"\n' +
      attrs + '>\n' +
      '   <crs:Name>\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">' + esc(p.name) + '</rdf:li>\n    </rdf:Alt>\n   </crs:Name>\n' +
      '   <crs:ShortName>\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">' + esc(p.name) + '</rdf:li>\n    </rdf:Alt>\n   </crs:ShortName>\n' +
      '   <crs:Group>\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">LUME</rdf:li>\n    </rdf:Alt>\n   </crs:Group>\n' +
      seq('ToneCurvePV2012', p.curve.rgb) + '\n' +
      seq('ToneCurvePV2012Red', p.curve.r) + '\n' +
      seq('ToneCurvePV2012Green', p.curve.g) + '\n' +
      seq('ToneCurvePV2012Blue', p.curve.b) + '\n' +
      '  </rdf:Description>\n </rdf:RDF>\n</x:xmpmeta>\n';
  }

  function safeFileName(name) {
    return String(name || 'preset').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || 'preset';
  }

  global.XMP = {
    neutral: neutral, normalize: normalize, isNeutral: isNeutral,
    parse: parse, serialize: serialize, safeFileName: safeFileName,
    HSL_KEYS: HSL_KEYS, HSL_NAMES: HSL_NAMES, HSL_HUES: HSL_HUES
  };
})(window);
