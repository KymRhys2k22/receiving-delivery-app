# Receiving Scanner App — Release v7.1 (Build 8)

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

### 📱 3. KeyboardAvoidingView & Modal UI Fix
- **Eliminated Keyboard Collision**: Replaced manual `keyboardHeight` listeners and offset padding with standard `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`.
- **Flush Input Docking**: Modals now sit flush against the software keyboard on Android with no elevation gaps, avoiding the bug where modal cards were pushed off-screen into the status bar.
- **Universal Fix**: Applied across Daizo Assistant, DLR Manual Code Entry, and DLR Cloud Records modals.
- **Adaptive Sheet Heights**: Updated modal containers to `{ height: '82%', maxHeight: '85%' }` for seamless responsive rendering.

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

---

## 📝 Git Commit & Tag Instructions

Run the following commands to commit all release changes and create the git tag:

```bash
git add .
git commit -m "feat(release): v7.1 (build 8) - store-scoped DLR, bidirectional SKU/UPC, hide cost, update semver, expo-image fix"
git tag -a v7.1.0 -m "Release v7.1 (Build 8)"
git push origin main --tags
```

### Commit Scope & Modified Files
- `screens/damageLostRecord.tsx`: Store code isolation, `KeyboardAvoidingView` modal fix, `expo-image` named import.
- `components/LocalAiFabModal.tsx`: Scoped data loading to active store, responsive keyboard layout, updated assistant header.
- `services/localAiService.ts`: Bidirectional SKU/UPC heuristics, cost data omitted, prompt context sanitized.
- `services/appUpdateService.ts`: Semver parser and comparator, multi-release ranking, dev version resolution.
- `utils/dlr.ts`: Store code and candidate name matching, PostgREST filtering.
- `screens/login.tsx` & `screens/three.tsx`: Version labels synchronized to `v7.1`.
- `app.json`, `package.json`, `package-lock.json`: Bumper version to `7.1` (Android `versionCode: 8`).

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
     8,
     '7.1.0',
     'v7.1.0: Store-filtered DLR records, bidirectional SKU ↔ UPC lookup in Daizo, and keyboard layout stability improvements.',
     'https://github.com/KymRhys2k22/receiving-delivery-app/releases/download/v7.1.0/receiving-scanner-v7.1.0.apk',
     false,
     NOW()
   );
   ```

---

## 🛠️ Verification & Commit Details

- **Android Version Code**: `8`
- **Application Version Name**: `7.1.0`
- **TypeScript**: `npx tsc --noEmit` passing (0 errors)
- **Live Device Verification**: Tested and verified on connected physical Android device (Redmi Note 10 Pro)
