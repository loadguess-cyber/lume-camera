const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('www/js/gl.js', 'utf8');

test('shader exposes all LUME effect uniforms', () => {
  for (const name of [
    'uMistMode', 'uMistStrength', 'uCrossRays',
    'uColorFilter', 'uColorAmount', 'uNdMultiplier'
  ]) {
    assert.match(source, new RegExp('uniform\\s+[^;]+\\s+' + name));
  }
});

test('renderer preserves and normalizes LUME extension', () => {
  assert.match(source, /LumeEffects\.normalize\(preset\s*&&\s*preset\.lume\)/);
});

test('final shader stage applies digital ND', () => {
  assert.match(source, /c\s*\*=\s*uNdMultiplier/);
});
