(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LumeEffects = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var OPTICAL_OPTIONS = [
    { id: 'off', label: '끄기', type: null, grade: null },
    { id: 'black-1-8', label: 'Black Mist 1/8', type: 'blackMist', grade: '1/8' },
    { id: 'black-1-4', label: 'Black Mist 1/4', type: 'blackMist', grade: '1/4' },
    { id: 'black-1-2', label: 'Black Mist 1/2', type: 'blackMist', grade: '1/2' },
    { id: 'white-1-8', label: 'White Mist 1/8', type: 'whiteMist', grade: '1/8' },
    { id: 'white-1-4', label: 'White Mist 1/4', type: 'whiteMist', grade: '1/4' },
    { id: 'white-1-2', label: 'White Mist 1/2', type: 'whiteMist', grade: '1/2' },
    { id: 'cross-4', label: 'Cross 4X', type: 'cross', grade: '4X' },
    { id: 'cross-6', label: 'Cross 6X', type: 'cross', grade: '6X' },
    { id: 'cross-8', label: 'Cross 8X', type: 'cross', grade: '8X' }
  ];

  var COLOR_OPTIONS = [
    { id: 'amber', label: 'Amber', rgb: [1.0, 0.72, 0.38] },
    { id: 'rose', label: 'Rose', rgb: [1.0, 0.48, 0.58] },
    { id: 'cyan', label: 'Cyan', rgb: [0.20, 0.88, 0.92] },
    { id: 'blue', label: 'Blue', rgb: [0.25, 0.50, 1.0] },
    { id: 'green', label: 'Green', rgb: [0.30, 0.82, 0.48] },
    { id: 'lavender', label: 'Lavender', rgb: [0.68, 0.52, 1.0] },
    { id: 'tobacco', label: 'Tobacco', rgb: [0.62, 0.34, 0.14] },
    { id: 'sunset', label: 'Sunset', rgb: [1.0, 0.38, 0.18] }
  ];

  var OPTICAL_TYPES = { blackMist: 1, whiteMist: 1, cross: 1 };
  var GRADES = {
    blackMist: { '1/8': 1, '1/4': 1, '1/2': 1 },
    whiteMist: { '1/8': 1, '1/4': 1, '1/2': 1 },
    cross: { '4X': 1, '6X': 1, '8X': 1 }
  };
  var COLOR_IDS = COLOR_OPTIONS.reduce(function (out, item) {
    out[item.id] = item;
    return out;
  }, {});

  function clamp(value, min, max, fallback) {
    value = Number(value);
    return isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function normalizeOptical(value) {
    if (!value || !OPTICAL_TYPES[value.type] || !GRADES[value.type][value.grade]) return null;
    return {
      type: value.type,
      grade: value.grade,
      amount: clamp(value.amount, 0, 1, 1)
    };
  }

  function normalizeColor(value) {
    if (!value || !COLOR_IDS[value.id]) return null;
    return { id: value.id, amount: clamp(value.amount, 0, 1, 1) };
  }

  function normalize(value) {
    value = value || {};
    return {
      optical: normalizeOptical(value.optical),
      color: normalizeColor(value.color),
      digitalNdStops: Math.round(clamp(value.digitalNdStops, 0, 4, 0))
    };
  }

  function ndMultiplier(stops) {
    return Math.pow(2, -clamp(stops, 0, 4, 0));
  }

  function opticalPreset(type, grade) {
    return normalize({ optical: { type: type, grade: grade, amount: 1 } }).optical;
  }

  function colorPreset(id) {
    return normalize({ color: { id: id, amount: 1 } }).color;
  }

  function colorRgb(id) {
    return COLOR_IDS[id] ? COLOR_IDS[id].rgb.slice() : [1, 1, 1];
  }

  return {
    OPTICAL_OPTIONS: OPTICAL_OPTIONS,
    COLOR_OPTIONS: COLOR_OPTIONS,
    normalize: normalize,
    ndMultiplier: ndMultiplier,
    opticalPreset: opticalPreset,
    colorPreset: colorPreset,
    colorRgb: colorRgb
  };
});
