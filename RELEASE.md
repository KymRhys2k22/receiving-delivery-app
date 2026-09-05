# Receiving Scanner App — Release v7.0.0 (Build 7)

**Release Date:** September 5, 2026  
**Tag:** `v7.0.0` (or `v7`)  
**Target:** Android (`arm64-v8a` APK)  
**SDK:** Expo SDK 56 · React Native 0.85.3  

---

## 🚀 What's New in v7.0.0

### 🤖 1. Daizo — On-Device Local AI Assistant
- **100% Offline-Capable LLM**: Integrated `SmolLM2-360M-Instruct` quantized (`Q4_K_M.gguf`) running natively on-device via `llama.rn` and C++ JSI bindings.
- **Floating Action Button (FAB) & Chat Modal**: Accessible from any screen with a tactile floating assistant button and modern slide-up modal sheet.
- **Closed-Book Hallucination Guardrails**: Queries are strictly grounded on live warehouse manifest records from Supabase and client-side offline storage (`AsyncStorage`). If information is absent, Daizo accurately reports `"Data not found in records."`
- **Streaming Taglish NLP**: Specially tuned for natural Tagalog/English warehouse colloquialisms, receiving terminology, damage status queries, and barcode lookups.
- **Rich Markdown Formatting**: Real-time token streaming with formatted tables, bullet points, copy-to-clipboard buttons, and quick question prompts.

### 🎨 2. Elevated Interface & Navigation
- **Refined Tab Bar**: Redesigned floating elevated bottom tab bar with subtle borders, active indicator glows, and smooth haptic feedback.
- **Visual Mascot Branding**: Integrated custom Daizo assistant branding with high-efficiency animated WebP status indicators for offline/online states.
- **Refreshed Status Dashboards**: Updated Login and Terminal Info dashboards displaying `v7.0.0` engine status and device runtime metrics.

### ⚡ 3. Engine & EAS Build Optimizations
- **EAS Build Architecture Streamlining**: Configured `arm64-v8a` single-ABI targeting via `expo-build-properties`, eliminating redundant emulator compiles and reducing APK package size.
- **Prebuilt C++ Native Artifact Downloader**: Lifecycle hook in `scripts/patch-llama-rn.js` automatically fetches verified prebuilt `jniLibs`, cutting cloud EAS build time from >45m down to ~5–8 minutes.
- **Dependency Resolution Resilience**: Pinned `.npmrc` legacy peer dependency configs and resolved React 19 / Expo 56 peer constraints.
- **Resource Merger Conflict Resolution**: Eliminated duplicate Android drawable resources to ensure seamless AAPT2 packaging.

---

## 📦 Supabase `app_updates` Release Checklist

When publishing this release to production:

1. **Upload APK to GitHub Releases**:
   - Create a release tag: `v7.0.0` (or `v7`).
   - Title: `v7.0.0 — Daizo Local AI Assistant & Elevated UI`.
   - Attach the built APK: `receiving-scanner-v7.0.0.apk`.
   - Copy the Direct Download URL of the attached APK.

2. **Register in Supabase**:
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
     7,
     '7.0.0',
     'Introducing Daizo: On-device local AI assistant with Taglish NLP, elevated UI navigation, and faster scanning engine.',
     'https://github.com/KymRhys2k22/receiving-delivery-app/releases/download/v7.0.0/receiving-scanner-v7.0.0.apk',
     false,
     NOW()
   );
   ```

---

## 🛠️ Verification & Commit Details

- **Commit**: `b189c4e` (`chore(release): bump app version to v7.0.0 (versionCode 7)`)
- **Fix Commit**: `f8a0c9b` (`fix(eas): download prebuilt llama.rn binaries and restrict buildArchs to arm64-v8a`)
- **Android Version Code**: `7`
- **Application Version Name**: `7.0.0`
