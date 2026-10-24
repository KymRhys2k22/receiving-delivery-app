# Receiving Scanner App — Release v7.3 (Build 11)

**Release Date:** October 24, 2026  
**Tag:** `v7.3` (or `v7.3.0`)  
**Target:** Android (`arm64-v8a` APK)  
**SDK:** Expo SDK 56 · React Native 0.85.3  

---

## 🚀 What's New in v7.3

### 📦 1. TRF Items Lookup & Cross-Reference Modal
- **TRF Item Lookup from Boxes**: In `screens/scanningBox.tsx`, users can tap any box card or quick chip to instantly cross-reference its items directly against uploaded manifest CSV records (`CID NO, TRF NO, UPC, SKU, DESCRIPTION, QTY`).
- **Direct CSV Upload/Refresh**: Manage and upload scanning items manifest CSV files straight from the TRF lookup header.
- **Search & Filtering**: Real-time filtering by SKU, UPC, or description with live scanned progress per item.

### 🖼️ 2. Interactive Large Image Preview & Gestures
- **Pinch-to-Zoom & Pan**: Full interactive modal allowing users to zoom in (up to `4.0x`) and pan around high-resolution product images.
- **Dedicated Zoom Controls**: Stepwise zoom in (`+0.5x`), zoom out (`-0.5x`), preset toggle (`1.0x` / `2.0x` / `3.0x`), and reset button (`RotateCcw`).
- **Detailed Specifications**: Displays full item description, technical identifiers (`SKU`, `UPC`, `BOX CID`, `TRF NO`), and quantity breakdown (`MANIFEST QTY`, `SCANNED QTY`, `REMAINING / OVERAGE`).

### 🌐 3. Conditional In-App Web Browser Search
- **External Web Search via `expo-web-browser`**: For items missing from Daiso and Cloudinary CDNs, the card presents a dedicated `SEARCH` button that opens Google Images using the item's UPC in an in-app Chrome Custom Tab.
- **Smart Conditional Visibility**: If an image is available, the search button is hidden and tapping enlarges the image instead.

### 🔄 4. Fast Swipe Tab Navigation & Camera Lifecycle Handoff
- **Swipe Gestures**: Quick horizontal swipe between `ScanningBoxScreen` and `ScanningItemScreen`.
- **Android CameraX Lifecycle Guard**: Automated watchdog preview revival and singleton `ProcessCameraProvider` self-healing to eliminate blank camera previews during rapid tab switches.

### 🎯 5. Barcode Zero-Normalization & Bluetooth Scanner Toggle
- **Zero-Stripping**: Normalizes barcode/SKU strings with leading zeros (e.g. `000260295` -> `260295`) before comparing against manifest data.
- **Bluetooth Scanner Toggle**: Dedicated toggle button on scanning screens to activate or pause the background Bluetooth physical scanner keyboard buffer.
- **1:1 Image Upload Modal**: Fixed camera modal black screen in `screens/scanningItem.tsx` by pausing background scanner camera, with a standard 1:1 camera upload frame.

---

# Receiving Scanner App — Release v7.2 (Build 10)

**Release Date:** September 5, 2026  
**Tag:** `v7.2` (or `v7.2.0`)  
**Target:** Android (`arm64-v8a` APK)  
**SDK:** Expo SDK 56 · React Native 0.85.3  

---

## 🚀 What's New in v7.2

### 🏪 1. Multi-Store Isolation for Damage Lost Record (DLR)
- **Zero Cross-Store Data Leakage**: In `screens/damageLostRecord.tsx`, DLR records are strictly filtered by the authenticated user's active store code (e.g. `202`, `212`, `233`).
- **Hybrid Code & Branch Name Resolution**: Automatically resolves store identifiers between numeric store numbers and full branch titles (e.g. `202` ↔ `RDSI - PAVILLION`) using `store.json`.
- **PostgREST Direct Filtering**: In `utils/dlr.ts`, queries filter server-side with `.in('Store Code', candidates)` and apply client-side validation to guarantee zero data leakage.
- **Store Badging**: Added clear `STORE <storeCode>` visual badges to the Cloud Records modal and Daizo Assistant headers.

### 🔍 2. Intelligent Bidirectional SKU ↔ UPC Lookup
- **Direct Taglish Q&A**: Asking Daizo questions like `"Anong SKU nito UPC 4550480272467"` or reverse `"Anong UPC nito SKU 322462"` immediately outputs a direct answer followed by complete specifications.
- **Full Item Breakdown**:
  - **SKU & UPC / Barcode**
  - **Description / Pangalan**
  - **Presyo (SRP)** *(Internal cost strictly hidden for commercial confidentiality)*
  - **Department & Category** (e.g. `Fashion (Apparel)`)
  - **Uploaded Manifest Status** (Total Qty, Scanned Qty, CID box, TRF number)
  - **Item DLR Records** (Defects, Quantities, Reporting Store)
- **Prompt Sanitization**: Sanitized catalog and DLR objects before passing to SmolLM2 prompt to prevent margin or cost leakage.

### 📱 3. Standalone APK Keyboard & Modal UI Fix
- **Fixed Soft Keyboard Covering Input in APK**: In standalone APK builds, `<Modal statusBarTranslucent>` caused Android's WindowManager to disable `adjustResize`, making the keyboard cover the input bar. Removing `statusBarTranslucent` restores full native `adjustResize` behavior on Android Dialog windows.
- **Explicit `softwareKeyboardLayoutMode`**: Added `"softwareKeyboardLayoutMode": "resize"` under `expo.android` in `app.json` to guarantee proper APK build properties.
- **Cross-Platform Avoidance**: Standardized on `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>` with `{ height: '82%', maxHeight: '85%' }`, allowing iOS to use padding avoidance while Android uses native `adjustResize`.
- **Auto-Scroll on Input Focus**: Added `onFocus` auto-scroll on `TextInput` in `LocalAiFabModal.tsx` so recent message history stays visible above the soft keyboard.
- **Verified via `agent-device`**: Directly tested on physical Android hardware (`M2101K6G`), confirming the input bar and Send button stay perfectly docked above the keyboard.

### 🔄 4. Semantic Versioning in App Update Service
- **Intelligent Semver Comparison**: Added `compareSemver` and `parseVersionSegments` in `services/appUpdateService.ts` to compare version strings (e.g. `v7.2` > `v7.1`).
- **Resilient Version Codes**: Seamlessly handles both integer build numbers (`8`, `9`) and decimal version inputs in database records (`7.2`).
- **Sorted Candidate Releases**: Queries recent releases and picks the highest semver/build record, eliminating false-positive "up-to-date" alerts.

### 🖼️ 5. `expo-image` Named Import Fix
- **Fixed JSX Type Errors**: Corrected `import Image from 'expo-image'` to `import { Image } from 'expo-image'` in `screens/damageLostRecord.tsx`, resolving `TS2604` and `TS2786` compilation errors.
- **High-Performance Image Caching**: Native image caching and smooth rendering for DLR photo captures and cloud thumbnails.

### 🎨 6. Assistant Branding & UI Polish
- **Daizo Assistant Header**: Renamed modal header to `Daizo Assistant` with status pills and active store tags.
- **System Version Sync**: Updated Login screen and Settings Dashboard to display engine status `v7.2`.
- **Tailwind Shadow Utility Fix**: Updated ambiguous `shadow-[#e5005c]` to `shadow-[#e5005c]/50` in `screens/damageLostRecord.tsx` to eliminate bundler warnings.

### 🛡️ 7. ThemeProvider Mount Safety & LogBox Cleanup
- **Eliminated Unmounted State Update**: Added `isMounted` guard to `ThemeProvider` in `context/theme.tsx` and removed unstable `setColorScheme` reference from `useEffect` dependencies, eliminating the React 18 *"Can't perform a React state update on a component that hasn't mounted yet"* console error.
- **LogBox Cleanup**: Added development ignore rule in `App.tsx` for clean testing.

---

## 📝 Git Commit & Tag Instructions

Run the following commands to commit, tag, and publish these updates:

```bash
git add .
git commit -m "feat(release): v7.3 (build 11) - TRF items lookup, image zoom modal, in-app UPC web search, swipe navigation, and zero-normalization"
git tag -a v7.3.0 -m "Release v7.3 (Build 11)"
git push origin main
git push origin v7.3.0
```

### Commit Scope & Modified Files
- `screens/scanningBox.tsx`:
  - Implemented TRF Items Lookup modal with Item Manifest CSV intake and real-time filtering.
  - Implemented interactive Large Image Preview modal with pinch-to-zoom (1.0x–4.0x), pan, double-tap, zoom controls (`+0.5x`, `-0.5x`, presets `1.0x` / `2.0x` / `3.0x`, and reset `RotateCcw`), and item technical specifications.
  - Implemented conditional in-app Google Images search via `expo-web-browser` with dynamic button visibility (hidden when image is available; clickable when missing).
  - Added horizontal swipe navigation to `ScanningItemScreen` and CameraX singleton lifecycle watchdog.
  - Added Bluetooth Scanner toggle button.
- `screens/scanningItem.tsx`:
  - Resolved camera modal black screen during item image upload by pausing background scanner camera.
  - Adjusted modal upload camera frame to 1:1 square aspect ratio.
  - Added leading zero-normalization (`normalizeLookupCode`) for barcode and SKU scanning.
  - Added Bluetooth Scanner toggle button.
- `app.json`: Bumped version to `7.3`, incremented `versionCode` to `11`.
- `package.json`: Bumped version to `7.3.0`, added `expo-web-browser`.
- `android/app/build.gradle`: Updated `versionCode 11`, `versionName "7.3.0"`.
- `services/appUpdateService.ts`: Synchronized development fallback version code to `11` and version name to `'7.3'`.
- `screens/three.tsx`: Updated Settings dashboard version display to `v7.3` and footer to `Version 7.3`.
- `screens/login.tsx`: Updated login system engine badge to `System v7.3`.
- `RELEASE.md`: Comprehensive release notes and deployment documentation for v7.3 (Build 11).

---

## 📦 Supabase `app_updates` Release Checklist

When publishing this release to production:

1. **Build the Production APK**:
   ```bash
   eas build -p android --profile production
   ```

2. **Upload APK to GitHub Releases**:
   - Create release tag: `v7.3.0` (or `v7.3`).
   - Title: `v7.3.0 — TRF Item Lookup, Interactive Image Zoom, In-App Web Search & Camera Handoff`.
   - Attach the built APK: `receiving-scanner-v7.3.0.apk`.
   - Copy the Direct Download URL of the attached APK.

3. **Register in Supabase**:
   Update or insert the release row in `public.app_updates`:
   ```sql
   INSERT INTO public.app_updates (
     version_code,
     version_name,
     release_notes,
     download_url,
     is_mandatory,
     released_at
   ) VALUES (
     11,
     '7.3.0',
     'v7.3.0: TRF item manifest lookup, interactive image zoom & pan, conditional in-app UPC web search, fast swipe navigation, and scanner camera lifecycle fixes.',
     'https://github.com/KymRhys2k22/receiving-delivery-app/releases/download/v7.3.0/receiving-scanner-v7.3.0.apk',
     false,
     NOW()
   );
   ```

---

## 🛠️ Verification & Commit Details

- **Android Version Code**: `11`
- **Application Version Name**: `7.3.0`
- **TypeScript**: `npx tsc --noEmit` passing (0 errors)
- **ESLint**: `npx eslint` passing (0 errors)
- **Live Device Verification**: Tested and verified on connected physical Android device (`M2101K6G`, Redmi Note 10 Pro)
- **Knowledge Graph**: Rebuilt and synchronized via `graphify update .`
