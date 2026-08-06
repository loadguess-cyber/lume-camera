const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('www/index.html', 'utf8');
const ui = fs.readFileSync('www/js/ui.js', 'utf8');

test('camera screen exposes effects and add preset controls', () => {
  for (const id of ['lookMode', 'lensMode', 'ndMode', 'addPreset', 'effectRail', 'activeEffects']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test('UI supports all three rail modes', () => {
  assert.match(ui, /railMode:\s*'look'/);
  assert.match(ui, /function buildLensRail/);
  assert.match(ui, /function buildNdRail/);
});

test('current combination can be saved as a user preset', () => {
  assert.match(ui, /function saveCurrentCombo/);
  assert.match(ui, /source\s*=\s*'user'/);
});

test('active effects can be removed independently', () => {
  assert.match(ui, /function removeEffect/);
});
