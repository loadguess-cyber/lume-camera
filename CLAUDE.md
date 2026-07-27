# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

LUME is a **Lightroom-preset photo app** built as a plain static web app and wrapped
for Android with Capacitor. Its core asset is a WebGL engine (`www/js/gl.js`) that
approximates Lightroom's develop pipeline, driven by presets parsed from / written to
real Lightroom `.xmp` files (`www/js/xmp.js`).

Three separate entry points share that one engine:

| Page | Purpose | Loads |
|---|---|---|
| `www/index.html` | Live camera — preset applied to the preview, photo/video capture | analyze, store, xmp, presets, gl, camera, ui, app |
| `www/studio.html` | LUME Studio — preset-first editing + batch export of existing photos | xmp, gl, presets, analyze, sample, zip, studio |
| `www/try.html` | Preset try-out page, no camera permission needed | xmp, gl, presets, sample + one inline IIFE |

The camera is the original product; Studio is the newer direction (see the
`LUME Studio` commit for the reasoning: WebView cannot do RAW, multi-frame HDR, or
ISO/shutter control on most devices, but none of that matters for editing photos
that already exist).

## Language conventions — important

The entire repository is **Korean**: user-facing strings, code comments, README,
commit messages, and even error messages. Keep it that way.

- New comments and UI copy → Korean.
- Commit messages → Korean subject line + a body that explains *why*, in prose,
  the way the existing commits do (read `git log` before writing one). Existing
  bodies describe the problem, the diagnosis, the fix, and what was actually
  verified. Match that depth; they are not one-liners.
- Identifiers, keys, and API names stay English (`temp`, `vignetteMid`, `bi_golden`).

## Architecture

**No build step, no bundler, no transpiler, no test runner.** Files in `www/` are
served as-is and are also exactly what Capacitor copies into the APK. Editing a file
under `www/` is the whole edit-run cycle.

**ES5 only, IIFE modules, globals on `window`.** Every JS file is
`(function (global) { 'use strict'; ... global.Name = {...}; })(window)`. Uses `var`,
function declarations, no `let`/`const`/arrow/class/template literals in `www/`.
(The Node scripts under `scripts/` are the exception — they run on Node 22 and use
modern syntax freely.)

**Script order matters** because there are no imports. Dependency direction:

```
XMP  ← (no deps)
GL   ← XMP
BUILTIN_PRESETS ← XMP
Analyze, Zip, SAMPLE ← (no deps)
Store ← (Capacitor, optional)
Cam   ← GL, Store, Analyze, XMP
UI    ← everything above
app.js ← Cam, UI, Store
```

Each HTML file lists its own `<script>` tags; adding a new module means adding it to
every page that needs it, in the right position.

**Zero runtime dependencies.** The only npm packages are Capacitor (native shell) and
optionally Playwright (dev-only, for `render-presets.js`). ZIP writing, PNG encoding,
and the sample scene are all hand-rolled to keep it that way. Do not add a library
without a strong reason.

### Module map (`www/js/`)

| File | Global | Responsibility |
|---|---|---|
| `xmp.js` | `XMP` | Preset data model, Lightroom XMP parse/serialize, `neutral()`, `normalize()` |
| `gl.js` | `GL` | The WebGL render engine, curve LUT construction, offscreen renderer, AWB gains |
| `presets.js` | `BUILTIN_PRESETS` | The 9 built-in presets, expressed in Lightroom units |
| `store.js` | `Store` | localStorage, settings, Capacitor bridge, file save/share, toast, haptics |
| `camera.js` | `Cam` | getUserMedia, pro controls, auto-WB loop, still capture, MediaRecorder |
| `analyze.js` | `Analyze` | Downsampled frame sampling → auto white balance gains, histogram |
| `ui.js` | `UI` | Camera screen, preset rail, preset editor, library, settings, pro panel (largest file, ~1.5k lines) |
| `app.js` | — | Boot, Android back button, visibility/battery handling |
| `studio.js` | — | Studio screen: photo tray, preset list, grid compare, batch export |
| `sample.js` | `SAMPLE` | Procedurally drawn sample scene (used when no photo is loaded) |
| `zip.js` | `Zip` | Dependency-free ZIP writer, stored (uncompressed) entries, UTF-8 filename flag |

### The preset data model

`XMP.neutral()` defines the canonical shape. Everything else normalizes into it via
`XMP.normalize()`, which fills missing fields — this is what keeps old saved presets
loadable after the schema grows.

```
{ id, name, author, created, source: 'app'|'xmp'|'builtin',
  basic: { temp, tint, exposure, contrast, highlights, shadows, whites, blacks,
           texture, clarity, dehaze, vibrance, saturation },
  curve: { rgb, r, g, b: [[x,y], ...],  param: { hi, lights, darks, sh, split* } },
  hsl:   { hue[8], sat[8], lum[8] },          // Red Orange Yellow Green Aqua Blue Purple Magenta
  grade: { shadow|mid|high|global: {h,s,l}, blending, balance },
  fx:    { vignette*, grain*, fade, sharpen, monochrome } }
```

**Units are Lightroom's units**, not normalized: exposure is EV (−5..+5), most others
are −100..+100, curve points are 0..255. `gl.js` divides by 100 when pushing uniforms —
keep the division at the uniform boundary, not in the data.

`fade` has no Lightroom equivalent; it round-trips through a private `lume:` XMP
namespace that Lightroom ignores.

### Render pipeline (`gl.js` fragment shader)

Order is deliberate and mirrors Lightroom:

```
AWB gains → linearize → white balance → exposure → highlights/shadows/whites/blacks
→ contrast → texture/clarity/dehaze/sharpen (two-radius blur) → tone curve LUT
→ HSL 8 bands → vibrance/saturation → monochrome → color grading → fade
→ vignette → grain → mix(original, graded, uAmount)
```

Points worth knowing before touching it:

- **Auto white balance is applied before everything and is not scaled by `uAmount`.**
  It is a camera correction, not part of the preset. Preset strength must never
  affect it.
- The tone curve is a 256×1 RGBA texture: `R` = master curve (including the
  parametric curve delta), `G/B/A` = per-channel red/green/blue. Built on the CPU in
  `buildCurveLUT()` with a monotone (Fritsch–Carlson) spline so curves never
  overshoot.
- HSL band weights are normalized by `wsum` so overlapping neighbouring bands don't
  double-apply. `BAND_C`/`BAND_W` in `gl.js` are the real band centres and widths;
  `XMP.HSL_HUES` is only the swatch colour shown in the editor and tracks them
  loosely. Changing a band centre means changing both.
- `isIdentityCurve()` and `hasLocal` skip the expensive branches when the preset
  doesn't use them — keep those guards when adding features.
- **One shared offscreen renderer** (`GL.renderTo`) serves capture, thumbnails, and
  Studio export. Each `new GL.Renderer(canvas)` is a separate WebGL context; browsers
  cap those, so do not create them per item — resize and reuse.

## Development workflows

```bash
npm install                      # only needed for Capacitor / Android

node scripts/preview-server.js   # → http://localhost:5183  (index/studio/try)
npm run serve                    # alternative: npx serve www -l 5173
npm run preview                  # same as preview-server.js
```

The camera only opens on `localhost` or `https`. `try.html` and `studio.html` need no
camera permission, so they work anywhere.

**Rendering presets to files without a browser session:**

```bash
npm i -D playwright                              # once
node scripts/render-presets.js                   # sample scene, all 9 built-ins
node scripts/render-presets.js --image photo.jpg
node scripts/render-presets.js --xmp mypreset.xmp
node scripts/render-presets.js --preset bi_cinema --amount 50
```

Writes PNGs plus a `sheet.png` contact sheet to `preset-render/` (gitignored). This
runs the real `gl.js` in headless Chromium, so it is the fastest way to verify an
engine change visually. `preview-presets.jpg` in the repo root was produced this way.

**Android build:**

```bash
npx cap add android                 # creates android/ (gitignored)
node scripts/patch-android.js       # permissions, portrait lock, app name, icon bg
node scripts/make-icons.js          # generates icons with a hand-written PNG encoder
npx cap sync android
cd android && ./gradlew assembleDebug
```

`npm run android:sync` chains patch + sync. `patch-android.js` is idempotent —
re-running it is always safe, and it must stay that way since CI runs it every build.

**CI** (`.github/workflows/`):
- `android.yml` — on push to `main`: builds a debug APK, uploads it as the `lume-apk`
  artifact. Needs Node 22 (Capacitor 8 requirement) and JDK 21.
- `pages.yml` — on push to `main`: publishes `www/` to GitHub Pages, so `/try.html`
  and `/studio.html` are reachable over https from a phone.

**There is no automated test suite.** Verification is manual, in a real browser, and
commit messages are expected to state what was actually exercised. When a change
affects the engine, render before/after PNGs with `render-presets.js` and compare.

## Conventions and patterns

**Adding a slider to the preset editor** — append a def to `BASIC_DEFS`, `FX_DEFS`, or
`CURVE_PARAM_DEFS` in `ui.js`. `buildPane()` builds the rows; `{ g: '제목' }` inserts a
section header. Tapping a row's name/value resets it to `dflt`. A new field also needs:
a default in `XMP.neutral()`, parse + serialize in `xmp.js`, and a uniform in `gl.js`.

**Adding a setting** — add the key with its default to `DEFAULT_SETTINGS` in
`store.js`, then a row in `buildSettings()` in `ui.js`. Settings persist under
`lume.settings.v1`; presets under `lume.presets.v1`; last-used preset/amount/mode under
`lume.state.v1`. Bump the version suffix only if a shape change is genuinely
incompatible — `XMP.normalize()` handles additive changes without a migration.

**Adding a built-in preset** — add a `P(id, name, {...})` entry in `presets.js` with an
`bi_` id. Only specify the fields that differ from neutral; `XMP.normalize()` fills
the rest.

**Saving files** — always go through `Store.saveFile()` / `Store.saveText()`. They
branch on `Store.isNative()`: Capacitor Filesystem into `Documents/LUME/` on Android,
an `<a download>` in the browser. Never call the Capacitor plugins directly from UI code.

**Capability-gated UI** — pro controls (ISO, shutter, exposure comp, color temp,
focus) are only rendered for keys that `track.getCapabilities()` actually reports.
If the browser doesn't expose it, the row is hidden rather than shown disabled.
Follow that pattern for anything device-dependent.

**Styling** — `styles.css` (camera) and `studio.css` (Studio) each define their own
`:root` custom properties, but share the identity: warm charcoal background, amber
accent, small radii, tabular numerals for values. Accent colour is used to signal
"this value is off its default", not for decoration.

## Gotchas learned the hard way

These are all fixes already made; don't reintroduce them.

- **Never upscale on capture.** `fitRect()` returns the crop that actually exists in
  the source. An earlier version derived the size from the short edge and produced
  1.33× interpolated photos.
- **One `takePhoto()` per shutter press.** `capturePhotos()` grabs a single still and
  re-encodes it per format. Calling capture once per format fired the shutter twice
  and saved two different moments.
- EXIF rotation is handled via `createImageBitmap(blob, { imageOrientation: 'from-image' })`.
  Without it, stills come out sideways.
- **`[hidden]` needs `display: none !important`** when the element also sets `display`.
  A hidden overlay was swallowing clicks in Studio.
- Studio **never mutates the loaded photo.** It stores only `presetId` + `amount` per
  photo and re-renders from the original canvas on export, so repeated exports never
  degrade. Preserve that.
- The ZIP writer stores entries uncompressed on purpose (JPEG/PNG barely deflate) and
  sets the UTF-8 flag so Korean filenames survive.
- The camera is released on `visibilitychange` and on Capacitor `appStateChange` —
  unless recording. Check `Cam.isRecording()` before stopping the stream.

## Current state

Working: XMP import/export, live preview, photo + video capture with audio, preset
editor (curves, HSL, color grading), 3:4 / 9:16 / 1:1, grid, torch, pinch zoom, tap
focus, pro controls where supported, auto WB, histogram, Studio batch export.

Stubbed: the community "마켓" tab in `buildStore()` (`ui.js`) renders `SAMPLE_FEED`
with no backend behind it. Wiring it up means replacing that feed with an API response
and routing downloads through `UI.importFiles()`.

Not implemented: iOS (`npx cap add ios` plus the two `Info.plist` usage strings —
see README), MediaStore integration so shots appear in the gallery app immediately,
and release signing (builds are debug-signed only).

## Repository layout

```
www/            the app — the only thing Capacitor ships
scripts/        Node build/dev helpers (modern JS, Node 22)
.github/        APK build + Pages deploy workflows
capacitor.config.json   appId com.iroir.lume, webDir www
preview-presets.jpg     contact sheet produced by render-presets.js
```

`android/`, `node_modules/`, and `preset-render/` are gitignored and generated.
