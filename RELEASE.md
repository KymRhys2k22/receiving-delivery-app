# Receiving Scanner App — Release v7.2 (Build 10)

**Release Date:** September 6, 2026  
**Tag:** `v7.2` (or `v7.2.0`)  
**Target:** Android (`arm64-v8a` APK)  
**SDK:** Expo SDK 56 · React Native 0.85.3  

---

## 🚀 What's New in v7.2

### ⚡ 1. Live Session Persistence & Focus Synchronization
- **Instant Focus Synchronization (`useFocusEffect`)**: Replaced passive `useEffect` with `useFocusEffect` across `screens/one.tsx`, `screens/two.tsx`, `screens/scanningBox.tsx`, and `screens/scanningItem.tsx`. Switching between tabs or navigating back from scanners instantly synchronizes progress with zero stale cache.
- **Active Manifest Filename Tracking**: Added `ACTIVE_BOX_FILE_KEY` and `ACTIVE_ITEM_FILE_KEY` in `utils/storage.ts`. The dashboard session banners and manifest upload cards now prominently show the active filename (e.g. `📄 Current: manifest.csv`).
- **Comprehensive Session Banner Controls**: Added real-time percentage indicators, total unit vs. row counts, and a dedicated **CLEAR** button (`Trash2`) to wipe active manifests and progress directly from the dashboard.
- **History Resumption Context**: Resuming a past session in `screens/two.tsx` now properly restores the active filename so the operator knows exactly which manifest is currently loaded.

### 📊 2. Resilient Multi-Column CSV Manifest Ingestion
- **Byte Order Mark (BOM) Sanitization**: Automatically strips UTF-8 BOM (`\uFEFF`) and zero-width spaces to avoid column header matching issues.
- **Greedy Whitespace & Delimiter Handling**: Configured `skipEmptyLines: 'greedy'` with trimmed header normalization.
- **Expanded Column Aliases**: Robust matching for warehouse CSV formats:
  - **CID**: `CID NO`, `CID`, `CID_NO`, `CIDNO`, `BOX CID`, `BOX CID NO`, `BOX NO`, `BOX`, `CONTAINER`
  - **TRF**: `TRF NO`, `TRF`, `TRF_NO`, `TRFNO`, `TRANSFER NO`, `TRANSFER`, `TRF NUMBER`
  - **UPC / Barcode**: `UPC`, `UPC NO`, `UPC_NO`, `BARCODE`, `EAN`, `EAN13`, `UPC CODE`
  - **SKU**: `SKU`, `SKU NO`, `SKU_NO`, `ITEM CODE`, `ITEM NO`, `ITEM SKU`, `PRODUCT CODE`
  - **Description**: `DESCRIPTION`, `DESC`, `ITEM DESCRIPTION`, `PRODUCT NAME`, `PRODUCT DESCRIPTION`, `NAME`
  - **Quantity**: `QTY`, `QUANTITY`, `EXPECTED QTY`, `TOTAL QTY`, `COUNT`, `AMOUNT`
- **Instant UI State Refresh**: Uploading manifests updates state immediately (`setSavedProgress` / `setSavedItemProgress`) without waiting for subsequent renders.

### 🎨 3. Edge-to-Edge Translucent Status Bar & SafeAreaView Architecture
- **Unified NativeWind `SafeAreaView`**: Added `cssInterop(SafeAreaView, { className: 'style' })` in `App.tsx` for consistent Tailwind styling.
- **Translucent Edge-to-Edge System Bars**: Enforced translucent status bars with adaptive `barStyle` (`light-content` / `dark-content`) across all screens:
  - `App.tsx`
  - `screens/one.tsx` (Receiving Dashboard)
  - `screens/two.tsx` (Scanning History)
  - `screens/three.tsx` (Settings)
  - `screens/login.tsx` (Login Terminal)
  - `screens/onBoardingGreet.tsx` (Welcome / Onboarding)
  - `screens/scanningBox.tsx` (Box CID Scanner)
  - `screens/scanningItem.tsx` (Item Barcode Scanner)
  - `screens/damageLostRecord.tsx` (DLR Module)
- **Refined Header Spacing**: Compacted header padding to `py-2.5` to seamlessly complement edge-to-edge status bars.

### 🤖 4. AI Modal Pull-Handle & Login Polish
- **Pull-Handle Drag Indicator**: Added visual top pull-indicator pill (`h-1.5 w-10 rounded-full`) to `LocalAiFabModal.tsx` for natural drawer affordance.
- **Login Screen Safe Area**: Wrapped `screens/login.tsx` with full safe area bounds (`edges={['top', 'bottom', 'left', 'right']}`) and smooth keyboard avoiding layout.

### 🏪 5. Multi-Store Isolation for Damage Lost Record (DLR)
- **Zero Cross-Store Data Leakage**: In `screens/damageLostRecord.tsx`, DLR records are strictly filtered by the authenticated user's active store code (e.g. `202`, `212`, `233`).
- **Hybrid Code & Branch Name Resolution**: Automatically resolves store identifiers between numeric store numbers and full branch titles (e.g. `202` ↔ `RDSI - PAVILLION`) using `store.json`.
- **PostgREST Direct Filtering**: In `utils/dlr.ts`, queries filter server-side with `.in('Store Code', candidates)` and apply client-side validation to guarantee zero data leakage.
- **Store Badging**: Added clear `STORE <storeCode>` visual badges to the Cloud Records modal and Daizo Assistant headers.

### 🔍 6. Intelligent Bidirectional SKU ↔ UPC Lookup
- **Direct Taglish Q&A**: Asking Daizo questions like `"Anong SKU nito UPC 4550480272467"` or reverse `"Anong UPC nito SKU 322462"` immediately outputs a direct answer followed by complete specifications.
- **Full Item Breakdown**:
  - **SKU & UPC / Barcode**
  - **Description / Pangalan**
  - **Presyo (SRP)** *(Internal cost strictly hidden for commercial confidentiality)*
  - **Department & Category** (e.g. `Fashion (Apparel)`)
  - **Uploaded Manifest Status** (Total Qty, Scanned Qty, CID box, TRF number)
  - **Item DLR Records** (Defects, Quantities, Reporting Store)
- **Prompt Sanitization**: Sanitized catalog and DLR objects before passing to SmolLM2 prompt to prevent margin or cost leakage.

### 📱 7. Standalone APK Keyboard & Modal UI Fix
- **Fixed Soft Keyboard Covering Input in APK**: In standalone APK builds, `<Modal statusBarTranslucent>` caused Android's WindowManager to disable `adjustResize`, making the keyboard cover the input bar. Removing `statusBarTranslucent` restores full native `adjustResize` behavior on Android Dialog windows.
- **Explicit `softwareKeyboardLayoutMode`**: Added `"softwareKeyboardLayoutMode": "resize"` under `expo.android` in `app.json` to guarantee proper APK build properties.
- **Cross-Platform Avoidance**: Standardized on `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>` with `{ height: '82%', maxHeight: '85%' }`, allowing iOS to use padding avoidance while Android uses native `adjustResize`.
- **Auto-Scroll on Input Focus**: Added `onFocus` auto-scroll on `TextInput` in `LocalAiFabModal.tsx` so recent message history stays visible above the soft keyboard.
- **Verified via `agent-device`**: Directly tested on physical Android hardware (`M2101K6G`), confirming the input bar and Send button stay perfectly docked above the keyboard.

### 🔄 8. Semantic Versioning in App Update Service
- **Intelligent Semver Comparison**: Added `compareSemver` and `parseVersionSegments` in `services/appUpdateService.ts` to compare version strings (e.g. `v7.2` > `v7.1`).
- **Resilient Version Codes**: Seamlessly handles both integer build numbers (`8`, `9`) and decimal version inputs in database records (`7.2`).
- **Sorted Candidate Releases**: Queries recent releases and picks the highest semver/build record, eliminating false-positive "up-to-date" alerts.

### 🖼️ 9. `expo-image` Named Import Fix
- **Fixed JSX Type Errors**: Corrected `import Image from 'expo-image'` to `import { Image } from 'expo-image'` in `screens/damageLostRecord.tsx`, resolving `TS2604` and `TS2786` compilation errors.
- **High-Performance Image Caching**: Native image caching and smooth rendering for DLR photo captures and cloud thumbnails.

### 🎨 10. Assistant Branding & UI Polish
- **Daizo Assistant Header**: Renamed modal header to `Daizo Assistant` with status pills and active store tags.
- **System Version Sync**: Updated Login screen and Settings Dashboard to display engine status `v7.2`.
- **Tailwind Shadow Utility Fix**: Updated ambiguous `shadow-[#e5005c]` to `shadow-[#e5005c]/50` in `screens/damageLostRecord.tsx` to eliminate bundler warnings.

### 🛡️ 11. ThemeProvider Mount Safety & LogBox Cleanup
- **Eliminated Unmounted State Update**: Added `isMounted` guard to `ThemeProvider` in `context/theme.tsx` and removed unstable `setColorScheme` reference from `useEffect` dependencies, eliminating the React 18 *"Can't perform a React state update on a component that hasn't mounted yet"* console error.
- **LogBox Cleanup**: Added development ignore rule in `App.tsx` for clean testing.

---

## 📝 Git Commit & Tag Instructions

Run the following commands to commit these changes:

```bash
git add .
git commit -m "feat(manifest): live session sync on focus, active file tracking, manifest clear action, resilient CSV ingestion, and edge-to-edge translucent status bar"
git push origin main
```

### Commit Scope & Modified Files
- `RELEASE.md`: Comprehensive changelog and commit instructions for v7.2.
- `screens/one.tsx`: Focus-based session synchronization (`useFocusEffect`), active filename display, `Trash2` clear button, BOM-clean resilient CSV parser, instant UI state refresh.
- `screens/two.tsx`: Focus-based history reload, active filename restoration on session resume.
- `screens/scanningBox.tsx`: `useFocusEffect` session reload, edge-to-edge translucent status bar.
- `screens/scanningItem.tsx`: `useFocusEffect` session reload, edge-to-edge translucent status bar.
- `screens/login.tsx`: `SafeAreaView` edges, translucent status bar, improved keyboard avoidance layout.
- `screens/three.tsx`: Updated footer to `Version 7.2`, edge-to-edge status bar.
- `screens/onBoardingGreet.tsx`: Edge-to-edge translucent status bar and background styling.
- `screens/damageLostRecord.tsx`: Store code isolation, translucent status bar, compact header.
- `components/LocalAiFabModal.tsx`: Visual pull-handle indicator pill, soft keyboard avoid fixes.
- `utils/storage.ts`: Added `ACTIVE_BOX_FILE_KEY` and `ACTIVE_ITEM_FILE_KEY` storage keys.
- `App.tsx`: `cssInterop(SafeAreaView)`, global translucent status bar, development log suppression.

---

## 📦 Supabase `app_updates` Release Checklist

When publishing this release to production:

1. **Build the APK**:
   ```bash
   eas build -p android --profile production
   ```

2. **Upload APK to GitHub Releases**:
   - Create release tag: `v7.2.0` (or `v7.2`).
   - Title: `v7.2.0 — Live Session Focus Sync, Resilient Manifests & Edge-to-Edge UI`.
   - Attach the built APK: `receiving-scanner-v7.2.0.apk`.
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
     10,
     '7.2.0',
     'v7.2.0: Live session focus synchronization, active manifest file tracking & clear action, resilient CSV ingestion, edge-to-edge status bar, store-isolated DLR, and bidirectional SKU ↔ UPC lookup in Daizo.',
     'https://github.com/KymRhys2k22/receiving-delivery-app/releases/download/v7.2.0/receiving-scanner-v7.2.0.apk',
     false,
     NOW()
   );
   ```

---

## 🛠️ Verification & Commit Details

- **Android Version Code**: `10`
- **Application Version Name**: `7.2.0`
- **TypeScript**: `npx tsc --noEmit` passing (0 errors)
- **Live Device Verification**: Tested and verified on connected physical Android device (Redmi Note 10 Pro)
