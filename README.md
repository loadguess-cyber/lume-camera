# LUME — 라이트룸 프리셋 카메라

라이트룸 `.xmp` 프리셋을 올리면 **그 색감 그대로 카메라 미리보기에 실시간 적용**되고,
그 상태로 사진·영상을 찍는 안드로이드 앱입니다. (iOS 는 같은 코드로 이어서 추가 가능)

![내장 프리셋 9종](preview-presets.jpg)

*↑ 같은 장면에 내장 프리셋 9종을 적용한 실제 렌더링 결과 (엔진 출력물)*

```
photo app/
├─ www/                  ← 앱 본체 (이것만 고치면 됩니다)
│  ├─ index.html
│  ├─ styles.css
│  └─ js/
│     ├─ store.js        저장소 · 파일 저장 · 공유
│     ├─ xmp.js          XMP 파싱/생성 · 프리셋 데이터 모델
│     ├─ presets.js      내장 프리셋 9종
│     ├─ gl.js           실시간 색보정 엔진 (WebGL 셰이더)
│     ├─ camera.js       카메라 · 사진 촬영 · 영상 녹화
│     ├─ ui.js           화면 · 편집기 · 보관함
│     └─ app.js          부팅 · 뒤로가기
├─ scripts/
│  ├─ patch-android.js   카메라 권한 · 세로 고정 · 앱 이름
│  └─ make-icons.js      앱 아이콘 생성 (외부 라이브러리 없음)
├─ capacitor.config.json
└─ .github/workflows/android.yml
```

---

## 무엇이 되나요

### 트렌드 LOOK · 디지털 렌즈 필터

- LOOK 10종: 청량 에어리, 핀터 에디토리얼, 콰이어트 럭셔리, 쿨 아날로그,
  코튼 스킨, 제주 블루, 서울 나이트, 크림 카페, 플래시 다이어리, 빈티지 디카
- LENS: Black Mist 1/8·1/4·1/2, White Mist 1/8·1/4·1/2,
  Cross 4X·6X·8X, 색상 필터 8종
- Digital ND: ND2·ND4·ND8·ND16
- 현재 LOOK + LENS + ND 조합을 사용자 프리셋으로 저장
- 촬영 화면의 `＋` 버튼에서 XMP 가져오기, 현재 룩 저장, 빈 프리셋 만들기

미스트와 크로스는 실제 유리 필터를 GPU로 근사한 창작 효과입니다. Digital ND도
센서에 들어오는 빛을 줄이는 광학 ND가 아니므로 실제 장노출이나 하이라이트 보호를
제공하지 않습니다. Lightroom XMP로 내보낼 때는 Lightroom 호환 색보정값만 전달되고
LUME 전용 렌즈 효과와 Digital ND는 Lightroom에서 재현되지 않습니다.

| 기능 | 상태 |
|---|---|
| XMP 프리셋 불러오기 → 실시간 미리보기 | ✅ |
| 프리셋 적용 상태 그대로 사진 촬영 | ✅ |
| 프리셋 적용 상태 그대로 영상 녹화(소리 포함) | ✅ |
| 프리셋 강도 조절 (0~100%) | ✅ |
| 프리셋 직접 만들기·수정 (톤커브·HSL·컬러그레이딩) | ✅ |
| 내가 만든 프리셋을 `.xmp` 로 내보내기 (라이트룸에서 그대로 열림) | ✅ |
| 3:4 · 9:16 · 1:1 비율, 격자, 플래시, 핀치 줌, 탭 초점 | ✅ |
| 커뮤니티 마켓 | 화면만 준비 (서버 미연결) |

### 실시간 반영되는 라이트룸 항목

색온도 · 색조 · 노출 · 대비 · 밝은 영역 · 어두운 영역 · 흰색 · 검정 ·
텍스처 · 부분 대비 · 안개 현상 제거 · 생동감 · 채도 ·
톤 커브(RGB/R/G/B + 매개변수 커브) · HSL 8채널(색조/채도/휘도) ·
컬러 그레이딩(어두운 영역/중간톤/밝은 영역/전체 + 혼합·균형) ·
비네팅 · 그레인 · 페이드 · 선명도 · 흑백 변환

> GPU 셰이더로 라이트룸 파이프라인을 **근사**합니다. 라이트룸이 RAW 에 적용하는 결과와
> 픽셀 단위로 같지는 않지만, 프리셋의 성격(색의 방향·톤의 모양)은 그대로 재현됩니다.
> 렌즈 보정·노이즈 제거·마스킹·프로파일(.dcp) 은 적용되지 않습니다.

---

## 빌드 방법

### A. GitHub Actions — 아무것도 설치하지 않음 (권장)

이 폴더를 **저장소 루트로** 올립니다.

```bash
git init && git add -A && git commit -m "LUME 카메라"
git branch -M main
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

푸시하면 자동으로 빌드가 돌고, 저장소 **Actions** 탭 → 최근 실행 → 아래 **Artifacts** 의
`lume-apk` 를 내려받으면 `app-debug.apk` 가 들어 있습니다.

### B. 내 PC 에서 빌드

```bash
npm install
npx cap add android
node scripts/patch-android.js && node scripts/make-icons.js
npx cap sync android
cd android && ./gradlew assembleDebug
```

결과물: `android/app/build/outputs/apk/debug/app-debug.apk`

Android Studio 를 쓴다면 `npx cap add android` 까지 한 뒤 `android` 폴더를 **Open** →
**Build → Build Bundle(s)/APK(s) → Build APK(s)**.

### C. PC 브라우저에서 미리 보기

```bash
npx serve www -l 5173
```

`http://localhost:5173` 접속. 웹캠으로 동작하며 저장은 브라우저 다운로드로 처리됩니다.
(카메라는 `localhost` 또는 `https` 에서만 열립니다)

---

## 앱을 고칠 때

`www/` 안의 파일만 고치면 됩니다. 다시 빌드하려면:

```bash
npx cap sync android
```

---

## iOS 추가하기 (나중에)

같은 `www/` 코드를 그대로 씁니다.

```bash
npm i @capacitor/ios && npx cap add ios
```

`ios/App/App/Info.plist` 에 아래 두 항목을 추가해야 카메라·마이크가 열립니다.

```xml
<key>NSCameraUsageDescription</key><string>사진과 영상을 촬영합니다</string>
<key>NSMicrophoneUsageDescription</key><string>영상 녹화 시 소리를 함께 담습니다</string>
```

macOS + Xcode 가 필요합니다.

---

## 다음 단계 (커뮤니티·수익화)

지금은 화면만 있고 서버가 없습니다. 붙일 때 필요한 것:

1. **백엔드** — 프리셋 업로드/검색/구매 API, 결제(인앱결제 또는 PG), 창작자 정산
2. **프리셋 포맷** — 이미 `.xmp` 표준을 쓰므로 그대로 주고받으면 됩니다
   (`XMP.serialize()` / `XMP.parse()`)
3. **연결 지점** — `www/js/ui.js` 의 `buildStore()` 가 마켓 화면입니다.
   `SAMPLE_FEED` 를 실제 API 응답으로 바꾸고, 다운로드 시 `UI.importFiles()` 와
   같은 경로로 프리셋을 추가하면 됩니다
4. **구글 플레이 인앱결제** — 유료 프리셋을 팔려면 스토어 정책상 인앱결제를 써야 합니다
   (`@capacitor-community/in-app-purchases` 등)

## 알아두면 좋은 것

- 사진·영상은 찍는 즉시 **문서/LUME** 폴더에 자동 저장됩니다.
  왼쪽 아래 썸네일을 누르면 크게 보고 **공유**할 수 있습니다.
  갤러리 앱에 바로 뜨게 하려면 MediaStore 연동 플러그인이 추가로 필요합니다.
- 프리셋은 앱 내부 저장소에 남습니다. 앱을 지우면 함께 사라지니
  중요한 프리셋은 **XMP 로 내보내** 백업해 두세요.
- 영상 녹화 형식은 기기가 지원하는 것을 자동 선택합니다 (mp4 우선, 안 되면 webm).
- 디버그 서명 APK 라 플레이 스토어 배포는 불가하고, 직접 설치용입니다.
