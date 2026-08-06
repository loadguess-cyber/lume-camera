# Mobile Trend Presets and Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add modern built-in looks, live lens effects, Digital ND, and an obvious add-preset flow to the deployed LUME mobile web app.

**Architecture:** Keep XMP-compatible color values in preset objects and add a normalized `lume` extension for lens/color/ND settings. Extend the existing WebGL renderer so preview, photo, and canvas-recorded video share the same effect path. Add a compact LOOK/LENS/ND control surface while preserving the current editor and import logic.

**Tech Stack:** Vanilla JavaScript, WebGL 1.0 GLSL, HTML/CSS, Node built-in test runner, GitHub Pages.

## Global Constraints

- Built-in presets are immutable; editing one creates a user copy.
- A stack contains at most one optical effect, one color filter, and one Digital ND value.
- Digital ND is labeled as a creative digital effect, not an optical ND.
- XMP export contains Lightroom-compatible color settings; LUME-only effects are preserved separately and disclosed.
- Existing camera, photo, video, editor, and XMP import behavior must remain functional.

---

### Task 1: Preset and filter model

**Files:**
- Create: `tests/lume-model.test.js`
- Create: `www/js/lume-effects.js`
- Modify: `www/js/presets.js`
- Modify: `www/index.html`

**Interfaces:**
- Produces: `LumeEffects.normalize(input)`, `LumeEffects.ndMultiplier(stops)`, `LumeEffects.opticalPreset(type, grade)`, `LumeEffects.colorPreset(id)`.
- Presets expose `preset.lume = { optical, color, digitalNdStops }`.

- [ ] **Step 1: Write failing model tests**

```js
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

test('ND4 converts two stops to quarter light', () => {
  assert.equal(LumeEffects.ndMultiplier(2), 0.25);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/lume-model.test.js`
Expected: FAIL because `www/js/lume-effects.js` does not exist.

- [ ] **Step 3: Implement normalized effect model and replace old built-ins**

Implement strict allowlists for optical types/grades, color IDs, amounts, and ND stops. Replace generic built-ins with the ten approved trend looks while retaining the existing XMP preset shape.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/lume-model.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/lume-model.test.js www/js/lume-effects.js www/js/presets.js www/index.html
git commit -m "feat: add trend presets and LUME effect model"
```

### Task 2: Shared WebGL effect rendering

**Files:**
- Create: `tests/shader-contract.test.js`
- Modify: `www/js/gl.js`

**Interfaces:**
- Consumes: normalized `preset.lume`.
- Produces: uniforms for mist, cross, color filter, and ND; same renderer is used by live preview and `GL.renderTo`.

- [ ] **Step 1: Write failing shader contract tests**

```js
test('shader exposes all LUME effect uniforms', () => {
  const source = fs.readFileSync('www/js/gl.js', 'utf8');
  for (const name of ['uMistMode', 'uMistStrength', 'uCrossRays', 'uColorFilter', 'uNdMultiplier']) {
    assert.match(source, new RegExp('uniform\\\\s+[^;]+\\\\s+' + name));
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/shader-contract.test.js`
Expected: FAIL because effect uniforms are absent.

- [ ] **Step 3: Implement minimal single-pass live effects**

Add bounded multi-tap highlight diffusion for black/white mist, directional highlight rays for Cross 4X/6X/8X, luminance-preserving color tint, and final linear ND multiplication. Map 1/8, 1/4, 1/2 to increasing strengths. Keep loops compile-time bounded for WebGL 1.0 compatibility.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/shader-contract.test.js tests/lume-model.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/shader-contract.test.js www/js/gl.js
git commit -m "feat: render lens filters and digital ND"
```

### Task 3: Mobile LOOK/LENS/ND controls and preset addition

**Files:**
- Create: `tests/mobile-ui-contract.test.js`
- Modify: `www/index.html`
- Modify: `www/styles.css`
- Modify: `www/js/ui.js`
- Modify: `www/js/store.js`

**Interfaces:**
- Consumes: `LumeEffects`, existing `UI.importFiles(files)`, existing editor.
- Produces: visible `LOOK`, `LENS`, `ND` tabs; `+ 프리셋` action; active effect chips; persisted user combinations.

- [ ] **Step 1: Write failing UI contract tests**

```js
test('camera screen exposes effects and add preset controls', () => {
  const html = fs.readFileSync('www/index.html', 'utf8');
  for (const id of ['lookMode', 'lensMode', 'ndMode', 'addPreset', 'effectRail', 'activeEffects']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/mobile-ui-contract.test.js`
Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Implement mobile controls**

Add mode tabs above the rail. LOOK renders built-in/user presets plus an add card. LENS renders Off, Black Mist grades, White Mist grades, Cross variants, and color filters. ND renders Off/ND2/ND4/ND8/ND16 with the required disclaimer. Add uses a bottom sheet with `XMP 가져오기` and `현재 룩을 새 프리셋으로 저장`.

- [ ] **Step 4: Persist and render active effect chips**

Normalize all loaded presets, persist `lume` fields with user presets, and let chips remove optical/color/ND independently.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/mobile-ui-contract.test.js tests/lume-model.test.js tests/shader-contract.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/mobile-ui-contract.test.js www/index.html www/styles.css www/js/ui.js www/js/store.js
git commit -m "feat: add mobile look lens and ND controls"
```

### Task 4: Browser verification and deployment

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: deployed mobile build at `https://loadguess-cyber.github.io/lume-camera/`.

- [ ] **Step 1: Run all automated tests**

Run: `node --test tests/*.test.js`
Expected: all PASS with no warnings.

- [ ] **Step 2: Verify local browser behavior**

Open the local server and check: ten LOOK cards, add preset sheet, each LENS option, ND disclaimer, active chips, editor save-as, XMP import, and no console errors.

- [ ] **Step 3: Verify rendering**

Render one synthetic scene through all ten looks, three mist strengths, three cross modes, eight color filters, and four ND levels. Confirm outputs differ and no WebGL errors occur.

- [ ] **Step 4: Update documentation**

Document LUME-only effect limitations, Digital ND disclaimer, and mobile test steps.

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs: explain trend looks and digital filters"
git push origin main
```

- [ ] **Step 6: Verify GitHub Pages**

Open `https://loadguess-cyber.github.io/lume-camera/`, confirm the new controls load, scripts return HTTP 200, and the browser console is clean.
