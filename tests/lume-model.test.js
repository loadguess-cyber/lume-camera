const test = require('node:test');
const assert = require('node:assert/strict');

const LumeEffects = require('../www/js/lume-effects.js');

test('normalizes unsupported effect values', () => {
  assert.deepEqual(LumeEffects.normalize({
    optical: { type: 'blackMist', grade: '1/4' },
    color: { id: 'amber', amount: 4 },
    digitalNdStops: 9
  }), {
    optical: { type: 'blackMist', grade: '1/4', amount: 1 },
    color: { id: 'amber', amount: 1 },
    digitalNdStops: 4
  });
});

test('drops unknown optical and color filters', () => {
  const value = LumeEffects.normalize({
    optical: { type: 'sparkle', grade: 'max' },
    color: { id: 'unknown', amount: 0.5 },
    digitalNdStops: -2
  });
  assert.equal(value.optical, null);
  assert.equal(value.color, null);
  assert.equal(value.digitalNdStops, 0);
});

test('ND4 converts two stops to quarter light', () => {
  assert.equal(LumeEffects.ndMultiplier(2), 0.25);
});

test('exposes approved optical and color choices', () => {
  assert.equal(LumeEffects.OPTICAL_OPTIONS.length, 10);
  assert.deepEqual(
    LumeEffects.COLOR_OPTIONS.map((item) => item.id),
    ['amber', 'rose', 'cyan', 'blue', 'green', 'lavender', 'tobacco', 'sunset']
  );
});
