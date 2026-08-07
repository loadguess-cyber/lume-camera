# LUME Native Android Camera and XMP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Capacitor camera prototype with a native Android app that uses Galaxy S26 Ultra camera capabilities, records stable filtered 4K 30fps video, captures maximum-quality photos, supports physical lenses and zoom, and renders imported XMP presets with a calibrated color pipeline.

**Architecture:** Commit a standalone Kotlin/Compose Android project under `android/`. CameraX 1.6.1 owns lifecycle, deterministic frame-rate queries, still capture, and video recording; Camera2 interop is isolated behind capability and lens-selection interfaces. A testable XMP/core-color module feeds an OpenGL ES 3 surface processor shared by preview and filtered recording. Media3 1.10.1 performs offline 8K preset export while original 8K capture remains on the device hardware path.

**Tech Stack:** Kotlin, Android Gradle Plugin, Jetpack Compose, CameraX 1.6.1, Camera2 interop, OpenGL ES 3.0, Media3 1.10.1, JUnit 5/AndroidX Test, GitHub Actions Java 21.

## Global Constraints

- Package/application ID remains `com.iroir.lume`.
- Minimum SDK is 23; target and compile SDK are 36.
- CameraX dependencies are pinned to stable `1.6.1`.
- Media3 dependencies are pinned to stable `1.10.1`.
- The app never silently lowers requested resolution or frame rate.
- Filtered real-time video targets 4K 30fps first; 4K 60/120fps appears only when the queried session supports it.
- 8K 30fps is recorded without a real-time filter and filtered through an explicit offline export.
- Unsupported Adobe profile, LookTable, and local-mask XMP fields are reported, not silently accepted.
- Existing `www/` prototype remains available for comparison but is not packaged in the native APK.

---

### Task 1: Native project, app shell, and build pipeline

**Files:**
- Create: `android/settings.gradle.kts`
- Create: `android/build.gradle.kts`
- Create: `android/gradle.properties`
- Create: `android/app/build.gradle.kts`
- Create: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/java/com/iroir/lume/MainActivity.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/LumeApp.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/theme/LumeTheme.kt`
- Create: `android/app/src/test/java/com/iroir/lume/NativeProjectContractTest.kt`
- Modify: `.github/workflows/android.yml`

**Interfaces:**
- Produces: native `com.iroir.lume` APK and `LumeApp()` Compose root.
- Consumes: no earlier native task.

- [ ] **Step 1: Write the failing project contract test**

```kotlin
class NativeProjectContractTest {
    @Test fun packageId_isStable() {
        assertEquals("com.iroir.lume", BuildConfig.APPLICATION_ID)
    }
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd android && ./gradlew testDebugUnitTest`

Expected: FAIL because the native Gradle project and `BuildConfig` do not exist.

- [ ] **Step 3: Create the minimal native project**

Configure `namespace` and `applicationId` as `com.iroir.lume`, `minSdk = 23`, `compileSdk = 36`, `targetSdk = 36`, Java/Kotlin target 17, Compose enabled, and dependencies for Compose BOM, Activity Compose, Lifecycle, CameraX `1.6.1`, Media3 `1.10.1`, and JUnit. `MainActivity` calls `setContent { LumeTheme { LumeApp() } }`.

The manifest must declare CAMERA, RECORD_AUDIO, foreground camera/microphone service types, required back camera, and portrait orientation. `LumeApp()` initially renders a black full-screen surface with `LUME NATIVE` and a permission status label.

- [ ] **Step 4: Replace generated-Capacitor CI with native Gradle CI**

Remove `npx cap add android`, `patch-android.js`, and `cap sync` from `.github/workflows/android.yml`. Build with `android/gradlew assembleDebug` and upload `android/app/build/outputs/apk/debug/app-debug.apk` as `lume-native-apk`.

- [ ] **Step 5: Run verification and commit**

Run: `cd android && ./gradlew testDebugUnitTest assembleDebug --no-daemon`

Expected: tests pass and debug APK exists.

Commit: `feat: 네이티브 안드로이드 앱 기반 추가`

---

### Task 2: Capability model, physical lenses, quality/FPS policy, and diagnostic screen

**Files:**
- Create: `android/app/src/main/java/com/iroir/lume/camera/CameraCapability.kt`
- Create: `android/app/src/main/java/com/iroir/lume/camera/CameraCapabilityRepository.kt`
- Create: `android/app/src/main/java/com/iroir/lume/camera/RecordingProfilePolicy.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/diagnostics/CameraDiagnosticsScreen.kt`
- Create: `android/app/src/test/java/com/iroir/lume/camera/RecordingProfilePolicyTest.kt`
- Modify: `android/app/src/main/java/com/iroir/lume/ui/LumeApp.kt`

**Interfaces:**
- Produces: `CameraCapabilityRepository.observe(): Flow<List<CameraCapability>>` and `RecordingProfilePolicy.resolve(request, capabilities): ProfileDecision`.
- `ProfileDecision` is `Supported(profile)` or `Rejected(requested, alternatives, reason)`; it has no implicit fallback case.
- Consumes: CameraX provider and Android `CameraManager` injected through the repository constructor.

- [ ] **Step 1: Write failing no-silent-downgrade tests**

```kotlin
@Test fun unsupported8k_isRejectedInsteadOfReturning4k() {
    val result = policy.resolve(ProfileRequest(7680, 4320, 30), only4k30)
    assertTrue(result is ProfileDecision.Rejected)
    assertEquals(listOf(Profile(3840, 2160, 30)), (result as ProfileDecision.Rejected).alternatives)
}

@Test fun exact4k30_isSelected() {
    assertEquals(ProfileDecision.Supported(Profile(3840, 2160, 30)),
        policy.resolve(ProfileRequest(3840, 2160, 30), only4k30))
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*RecordingProfilePolicyTest'`

Expected: FAIL because policy types do not exist.

- [ ] **Step 3: Implement capability and policy models**

Represent logical camera ID, physical camera IDs, focal length, sensor size, zoom ratio range, hardware level, supported JPEG sizes, normal/high-speed video profiles, dynamic ranges, stabilization modes, and encoder MIME types. Label lens buttons from optical focal-length ordering; retain the actual camera ID behind every label.

- [ ] **Step 4: Add the diagnostics UI**

Show device model, each logical/physical camera, inferred `0.6x/1x/3x/5x` labels, native focal length, digital-crop status, JPEG maximum size, and supported `resolution × FPS × codec` rows. Add a copy-to-clipboard button so the S26 Ultra report can be returned for tuning.

- [ ] **Step 5: Verify and commit**

Run: `cd android && ./gradlew testDebugUnitTest lintDebug assembleDebug --no-daemon`

Commit: `feat: 카메라 성능과 렌즈 진단 추가`

---

### Task 3: Native preview, lens/zoom controls, maximum-quality photo, and original video

**Files:**
- Create: `android/app/src/main/java/com/iroir/lume/camera/CameraSessionController.kt`
- Create: `android/app/src/main/java/com/iroir/lume/camera/CaptureRequest.kt`
- Create: `android/app/src/main/java/com/iroir/lume/camera/CaptureResult.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/camera/CameraScreen.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/camera/CameraViewModel.kt`
- Create: `android/app/src/test/java/com/iroir/lume/camera/CapturePolicyTest.kt`
- Modify: `android/app/src/main/java/com/iroir/lume/ui/LumeApp.kt`

**Interfaces:**
- Produces: `CameraSessionController.bind(config)`, `setLens(cameraId)`, `setZoomRatio(ratio)`, `capturePhoto(output)`, `startRecording(output)`, and `stopRecording()`.
- Emits: `StateFlow<CameraState>` containing selected lens, requested/active profile, zoom, recording duration, dropped-frame counters, and explicit errors.
- Consumes: capability repository and exact `ProfileDecision.Supported` values from Task 2.

- [ ] **Step 1: Write failing maximum-photo and exact-profile policy tests**

```kotlin
@Test fun photoPolicy_selectsLargestSupportedJpeg() {
    assertEquals(Size(16320, 12240), CapturePolicy.maxJpeg(listOf(Size(4000, 3000), Size(16320, 12240))))
}

@Test fun bindRejectsProfileThatWasNotReported() {
    assertFailsWith<UnsupportedCaptureCombination> {
        CapturePolicy.requireSupported(Profile(7680, 4320, 30), setOf(Profile(3840, 2160, 30)))
    }
}
```

- [ ] **Step 2: Verify RED**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*CapturePolicyTest'`

- [ ] **Step 3: Implement CameraX session binding**

Bind Preview, MAXIMIZE_QUALITY ImageCapture, and Recorder VideoCapture using a required SessionConfig and exact expected frame-rate range. Use `MediaStoreOutputOptions` for scoped-storage output. Preserve JPEG EXIF and report the actual saved width, height, FPS, MIME, duration, and camera ID in `CaptureResult`.

- [ ] **Step 4: Implement native camera UI**

Create the LUME black camera surface with top status, physical-lens chips, continuous zoom slider, photo/video mode switch, exact quality selector, shutter, elapsed recording time, and a diagnostics shortcut. Disable a combination only after capability rejection and display the reason beside it.

- [ ] **Step 5: Instrumented S26 Ultra checkpoint**

Run: `cd android && ./gradlew connectedDebugAndroidTest`

Manual device checks: each reported physical lens opens; zoom does not crash; JPEG dimensions match the selected maximum; 4K 30 original video metadata is exactly 3840×2160 and near 30fps; 8K is shown only if the device reports it.

- [ ] **Step 6: Verify and commit**

Run: `cd android && ./gradlew testDebugUnitTest lintDebug assembleDebug --no-daemon`

Commit: `feat: 네이티브 고화질 촬영과 줌 구현`

---

### Task 4: XMP compatibility model and calibrated CPU reference renderer

**Files:**
- Create: `android/app/src/main/java/com/iroir/lume/preset/LumePreset.kt`
- Create: `android/app/src/main/java/com/iroir/lume/preset/XmpParser.kt`
- Create: `android/app/src/main/java/com/iroir/lume/preset/XmpExporter.kt`
- Create: `android/app/src/main/java/com/iroir/lume/color/ColorPipeline.kt`
- Create: `android/app/src/main/java/com/iroir/lume/color/ToneCurve.kt`
- Create: `android/app/src/main/java/com/iroir/lume/color/HslMixer.kt`
- Create: `android/app/src/test/resources/xmp/reference-supported.xmp`
- Create: `android/app/src/test/resources/xmp/reference-unsupported.xmp`
- Create: `android/app/src/test/java/com/iroir/lume/preset/XmpRoundTripTest.kt`
- Create: `android/app/src/test/java/com/iroir/lume/color/ColorPipelineTest.kt`

**Interfaces:**
- Produces: `XmpParser.parse(xml): XmpImportResult`, `XmpExporter.write(preset): String`, and `ColorPipeline.renderPixel(linearRgb, preset): LinearRgb`.
- `XmpImportResult` contains normalized `LumePreset` plus a list of `Supported`, `Approximated`, and `Unsupported` field reports.
- Consumes: no Android UI or camera types; this package remains JVM-testable.

- [ ] **Step 1: Write failing XMP compatibility tests**

```kotlin
@Test fun cameraProfileAndMasksAreReportedUnsupported() {
    val result = parser.parse(resource("xmp/reference-unsupported.xmp"))
    assertEquals(FieldSupport.Unsupported, result.report["CameraProfile"]?.support)
    assertEquals(FieldSupport.Unsupported, result.report["MaskGroupBasedCorrections"]?.support)
}

@Test fun supportedFieldsSurviveRoundTrip() {
    val first = parser.parse(resource("xmp/reference-supported.xmp")).preset
    val second = parser.parse(exporter.write(first)).preset
    assertEquals(first, second)
}
```

- [ ] **Step 2: Verify RED, then implement the normalized model and parser/exporter**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*XmpRoundTripTest'`

Parse exposure, contrast, highlights, shadows, whites, blacks, temperature/tint, clarity/dehaze approximations, vibrance/saturation, composite/RGB point curves, HSL eight-color values, and color grading. Report CameraProfile, LookTable, lens-profile dependence, and local masks as unsupported.

- [ ] **Step 3: Write failing color-order and transfer-function tests**

```kotlin
@Test fun exposureOneStopDoublesLinearLightBeforeToneCurve() {
    val preset = neutral.copy(exposure = 1f)
    assertRgbNear(LinearRgb(.36f, .36f, .36f), pipeline.renderPixel(LinearRgb(.18f, .18f, .18f), preset), 0.002f)
}

@Test fun neutralPresetPreservesGrayAxis() {
    grayRamp.forEach { gray -> assertRgbNear(gray, pipeline.renderPixel(gray, neutral), 0.001f) }
}
```

- [ ] **Step 4: Implement the CPU reference pipeline**

Implement the exact design order: YUV/linear input contract, white balance, exposure, basic tone controls, composite/channel curves, HSL, vibrance/saturation, grading, clarity/dehaze approximations, optical effects, and output transfer. Use the CPU implementation as the canonical behavior for shader comparisons.

- [ ] **Step 5: Verify and commit**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*Xmp*' --tests '*ColorPipeline*'`

Commit: `feat: XMP 호환성 모델과 기준 색엔진 추가`

---

### Task 5: OpenGL surface processor and filtered 4K 30fps recording

**Files:**
- Create: `android/app/src/main/java/com/iroir/lume/render/LumeCameraEffect.kt`
- Create: `android/app/src/main/java/com/iroir/lume/render/LumeSurfaceProcessor.kt`
- Create: `android/app/src/main/java/com/iroir/lume/render/GlRenderer.kt`
- Create: `android/app/src/main/assets/shaders/lume_vertex.glsl`
- Create: `android/app/src/main/assets/shaders/lume_color_fragment.glsl`
- Create: `android/app/src/main/assets/shaders/lume_optical_fragment.glsl`
- Create: `android/app/src/main/java/com/iroir/lume/performance/FramePerformanceMonitor.kt`
- Create: `android/app/src/test/java/com/iroir/lume/performance/FramePerformanceMonitorTest.kt`
- Create: `android/app/src/androidTest/java/com/iroir/lume/render/ShaderParityTest.kt`
- Modify: `android/app/src/main/java/com/iroir/lume/camera/CameraSessionController.kt`
- Modify: `android/app/src/main/java/com/iroir/lume/ui/camera/CameraScreen.kt`

**Interfaces:**
- Produces: one `CameraEffect` targeting `PREVIEW or VIDEO_CAPTURE`, preset updates through an immutable `RenderParameters`, and `PerformanceState` with render p95, effective FPS, dropped frames, and thermal status.
- Consumes: `LumePreset` and CPU reference results from Task 4.

- [ ] **Step 1: Write failing frame-budget policy test**

```kotlin
@Test fun repeated4k30BudgetMissesRejectFilteredRecording() {
    val monitor = FramePerformanceMonitor(targetFps = 30)
    repeat(90) { monitor.recordFrame(renderNanos = 40_000_000, dropped = true) }
    assertEquals(Readiness.Blocked("GPU_FRAME_BUDGET"), monitor.readiness())
}
```

- [ ] **Step 2: Verify RED and implement performance policy**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*FramePerformanceMonitorTest'`

Require a 10-second 4K 30fps warmup with p95 render time within 33.3ms and effective FPS at least 29 before enabling filtered recording. Do not change the profile automatically when blocked.

- [ ] **Step 3: Write shader parity instrumentation tests before shaders**

Render fixed gray, skin, sky, foliage, and highlight patches through the CPU reference and GPU shader. Require maximum per-channel absolute error no greater than 2/255 for supported controls and neutral output error no greater than 1/255.

Run: `cd android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.iroir.lume.render.ShaderParityTest`

Expected: FAIL because the GL renderer is absent.

- [ ] **Step 4: Implement shared GPU color and optical passes**

Use external OES input, linear working RGB, 1D curve textures, HSL uniforms/LUT, and a separate bounded optical pass for mist/cross/color/ND. Reuse output surfaces supplied by CameraX so preview and VideoCapture receive the same processed frames without Canvas readback.

- [ ] **Step 5: Add LOOK/LENS/ND native controls and recording readiness UI**

Port the ten bundled looks and existing effect values. Show requested profile, measured FPS, thermal warning, and the exact blocking reason. Keep unfiltered recording available if the effect processor fails.

- [ ] **Step 6: S26 Ultra filtered-video checkpoint**

Record five-minute 4K 30fps clips with neutral, a heavy XMP look, Black Mist 1/2, and Cross 8X. Inspect output metadata and frame timestamps; each clip must remain 3840×2160 and average at least 29fps without audio drift visible over one frame.

- [ ] **Step 7: Verify and commit**

Run: `cd android && ./gradlew testDebugUnitTest connectedDebugAndroidTest lintDebug assembleDebug --no-daemon`

Commit: `feat: GPU 필터와 4K 실시간 녹화 구현`

---

### Task 6: Maximum-resolution photo rendering, XMP comparison UI, and 8K offline export

**Files:**
- Create: `android/app/src/main/java/com/iroir/lume/photo/PhotoRenderWorker.kt`
- Create: `android/app/src/main/java/com/iroir/lume/video/VideoExportWorker.kt`
- Create: `android/app/src/main/java/com/iroir/lume/video/ExportEstimator.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/preset/XmpImportScreen.kt`
- Create: `android/app/src/main/java/com/iroir/lume/ui/preset/ReferenceCompareScreen.kt`
- Create: `android/app/src/test/java/com/iroir/lume/video/ExportEstimatorTest.kt`
- Create: `android/app/src/androidTest/java/com/iroir/lume/photo/MaximumPhotoRenderTest.kt`
- Modify: `android/app/src/main/java/com/iroir/lume/ui/LumeApp.kt`

**Interfaces:**
- Produces: WorkManager jobs that persist progress and return saved MediaStore URIs; comparison UI consumes a reference Lightroom export plus LUME output.
- Consumes: Task 3 maximum-resolution capture, Task 4 preset/report model, and Task 5 GPU parameters.

- [ ] **Step 1: Write failing export-estimate tests**

```kotlin
@Test fun eightKEstimateIncludesInputOutputAndSafetyMargin() {
    val e = estimator.estimate(durationMs = 60_000, inputBitrate = 80_000_000, outputBitrate = 80_000_000)
    assertTrue(e.requiredBytes >= 1_320_000_000L)
}
```

- [ ] **Step 2: Verify RED and implement estimator/storage gate**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*ExportEstimatorTest'`

Before export, require input size plus estimated output size plus 10% safety margin. Show estimated duration as a measured range after the first ten seconds rather than claiming an exact time.

- [ ] **Step 3: Write maximum-photo instrumentation test and verify RED**

Capture a device-reported maximum JPEG, render neutral, and assert output dimensions equal the input dimensions and EXIF orientation/time/lens fields remain present.

- [ ] **Step 4: Implement tiled high-resolution photo rendering**

Render source JPEG/DNG-derived bitmap tiles through an offscreen GL context to avoid full-image GPU allocation. Save JPEG with selectable quality and preserve EXIF. Keep the original when requested.

- [ ] **Step 5: Implement XMP import and reference comparison UI**

Use Android's document picker for XMP and reference image selection. Present supported/approximated/unsupported counts before import. Provide a draggable split view, gray-axis and selected-color patch deltas, and the controls most responsible for the difference.

- [ ] **Step 6: Implement 8K original capture handoff and Media3 export**

Keep original 8K capture on the exact supported native profile. Queue explicit offline export through Media3 Transformer with the LUME GL effect, preserving audio and using the selected supported HEVC/H.264 encoder profile. Never label the exported file 8K unless its decoded dimensions are 7680×4320.

- [ ] **Step 7: Full verification and preview APK**

Run: `cd android && ./gradlew testDebugUnitTest connectedDebugAndroidTest lintDebug assembleDebug --no-daemon`

On S26 Ultra verify physical lenses, zoom, maximum JPEG, original 8K 30, filtered 4K 30, XMP compatibility report, reference comparison, and 8K offline output metadata. Publish the debug APK only after recording the capability report and test results in the release notes.

Commit: `feat: 고해상도 사진과 8K 후처리 완성`

---

### Task 7: Regression suite, migration notice, and release workflow

**Files:**
- Create: `android/app/src/test/java/com/iroir/lume/ReleaseContractTest.kt`
- Create: `docs/device-tests/galaxy-s26-ultra.md`
- Modify: `README.md`
- Modify: `.github/workflows/android.yml`

**Interfaces:**
- Produces: reproducible native APK artifact and device-test report.
- Consumes: all earlier tasks.

- [ ] **Step 1: Add failing release contract tests**

Verify the manifest declares camera/audio permissions, native launcher activity, no Capacitor bridge activity, and no WebView camera entry point in the APK.

- [ ] **Step 2: Verify RED, implement release checks, and remove prototype packaging paths**

Run: `cd android && ./gradlew testDebugUnitTest --tests '*ReleaseContractTest'`

Keep `www/` for visual reference, but ensure workflow inputs and APK assets exclude it.

- [ ] **Step 3: Record S26 Ultra evidence**

Document model/build, Android version, every camera ID and focal length, exact working profiles, five-minute filtered-recording FPS, temperature warnings, output metadata, unsupported combinations, and XMP reference fixtures in `docs/device-tests/galaxy-s26-ultra.md`.

- [ ] **Step 4: Run final verification**

Run: `node --test tests/*.test.js`

Run: `cd android && ./gradlew clean testDebugUnitTest connectedDebugAndroidTest lintDebug assembleDebug --no-daemon`

Expected: zero failed tests, zero lint errors, native APK present, and the legacy web tests still pass.

- [ ] **Step 5: Commit and publish preview**

Commit: `release: LUME 네이티브 카메라 프리뷰`

Push only after reviewing the diff and device evidence. Upload the resulting APK as a prerelease and state that 8K filtering is offline, not real time.
