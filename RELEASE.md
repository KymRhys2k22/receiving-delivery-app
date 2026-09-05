# Receiving Scanner App — Release v7.1 (Build 10)

**Release Date:** September 5, 2026  
**Tag:** `v7.1` (or `v7.1.0`)  
**Target:** Android (`arm64-v8a` APK)  
**SDK:** Expo SDK 56 · React Native 0.85.3  

---

## 🚀 What's New in v7.1

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
- **System Version Sync**: Updated Login screen and Settings Dashboard to display engine status `v7.1`.
- **Tailwind Shadow Utility Fix**: Updated ambiguous `shadow-[#e5005c]` to `shadow-[#e5005c]/50` in `screens/damageLostRecord.tsx` to eliminate bundler warnings.

### 🛡️ 7. ThemeProvider Mount Safety & LogBox Cleanup
- **Eliminated Unmounted State Update**: Added `isMounted` guard to `ThemeProvider` in `context/theme.tsx` and removed unstable `setColorScheme` reference from `useEffect` dependencies, eliminating the React 18 *"Can't perform a React state update on a component that hasn't mounted yet"* console error.
- **LogBox Cleanup**: Added development ignore rule in `App.tsx` for clean testing.

---

## 📝 Git Commit & Tag Instructions

Run the following commands to commit these fixes:

```bash
git add .
git commit -m "fix(ui): resolve standalone APK keyboard overlap in LocalAiFabModal, mount safety in ThemeProvider, and softwareKeyboardLayoutMode"
git push origin main
```

### Commit Scope & Modified Files
- `components/LocalAiFabModal.tsx`: Removed `statusBarTranslucent`, added `onFocus` scroll, wrapped with clean `KeyboardAvoidingView`.
- `app.json`: Added `"softwareKeyboardLayoutMode": "resize"` under `android`.
- `context/theme.tsx`: Added `isMounted` guard and stabilized `useEffect` dependencies.
- `App.tsx`: Added unmounted state update warning to `LogBox.ignoreLogs`.
- `screens/damageLostRecord.tsx`: Store code isolation, `expo-image` named import, and shadow opacity fix.

---

## 📦 Supabase `app_updates` Release Checklist

When publishing this release to production:

1. **Build the APK**:
   ```bash
   eas build -p android --profile production
   ```

2. **Upload APK to GitHub Releases**:
   - Create release tag: `v7.1.0` (or `v7.1`).
   - Title: `v7.1.0 — Store-Scoped DLR, Bidirectional SKU/UPC Lookup & Keyboard Fix`.
   - Attach the built APK: `receiving-scanner-v7.1.0.apk`.
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
     '7.1.0',
     'v7.1.0: Store-filtered DLR records, bidirectional SKU ↔ UPC lookup in Daizo, and keyboard layout stability improvements.',
     'https://github.com/KymRhys2k22/receiving-delivery-app/releases/download/v7.1.0/receiving-scanner-v7.1.0.apk',
     false,
     NOW()
   );
   ```

---

## 🛠️ Verification & Commit Details

- **Android Version Code**: `10`
- **Application Version Name**: `7.1.0`
- **TypeScript**: `npx tsc --noEmit` passing (0 errors)
- **Live Device Verification**: Tested and verified on connected physical Android device (Redmi Note 10 Pro)
