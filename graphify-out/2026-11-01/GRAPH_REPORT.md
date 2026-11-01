# Graph Report - receiving-delivery-app  (2026-11-01)

## Corpus Check
- 52 files · ~179,189 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 677 nodes · 1123 edges · 72 communities (31 shown, 41 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `87a59368`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useTheme
- dlr.ts
- expo
- devDependencies
- patch-llama-rn.js
- Industrial Verification Logic Design System
- ScreenContent.tsx
- rebox.ts
- tsconfig.json
- BackButton.tsx
- Button.tsx
- metro.config.js
- Android Adaptive Icon Asset
- Daiso Brand Logo
- Daizo Splash Image
- Delivery Elephant Mascot
- Delivery Elephant Mascot App Icon
- Application Branding and Visual Identity
- HeaderButton.tsx
- TabBarIcon.tsx
- eslint.config.js
- css-env.d.ts
- @react-native-async-storage/async-storage
- dependencies
- New session - 2026-08-26T06:38:56.026Z
- expo-document-picker
- expo-network
- expo-image
- expo-sharing
- App Releases, Supabase Updates & Notifications Guidelines
- expo-status-bar
- appUpdateService.ts
- expo-application
- TASK.md
- react
- expo-web-browser
- react-native-gesture-handler
- react-native-reanimated
- react-native-safe-area-context
- expo-haptics
- react-native-worklets
- scanningItem.tsx
- @react-navigation/native
- nativewind
- react-native-markdown-display
- xlsx
- DESIGN.md
- session-ses_fc33.md
- rules/graphify.md
- workflows/graphify.md
- expo-camera
- Receiving & Delivery Scanner App (Daizo) — v7.4
- react-native-screens
- expo-file-system
- react-native-keyboard-controller
- papaparse
- expo-splash-screen
- @expo/ui
- expo-image-manipulator
- llama.rn
- expo-notifications
- react-native-svg
- @react-navigation/bottom-tabs
- expo-font
- 🚀 What's New in v7.2
- @react-navigation/stack
- react-native

## God Nodes (most connected - your core abstractions)
1. `New session - 2026-08-26T06:38:56.026Z` - 90 edges
2. `useTheme()` - 32 edges
3. `useAuth()` - 22 edges
4. `ReboxHubScreen()` - 22 edges
5. `ReboxScannerScreen()` - 21 edges
6. `DamageLostRecordScreen()` - 17 edges
7. `expo` - 15 edges
8. `normalizeBoxNumber()` - 13 edges
9. `matchRecordStore()` - 12 edges
10. `ItemManifestRecord` - 12 edges

## Surprising Connections (you probably didn't know these)
- `ProductCard()` --calls--> `useTheme()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/theme.tsx
- `ReasonPickerModal()` --calls--> `useTheme()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/theme.tsx
- `Damage Lost Record (DLR) Multi-Step Flow` --conceptually_related_to--> `Verification Component Patterns`  [INFERRED]
  session-ses_fc33.md → DESIGN.md
- `AppContent()` --calls--> `initAppUpdateChecker()`  [EXTRACTED]
  App.tsx → services/appUpdateService.ts
- `HistoryModal()` --calls--> `useTheme()`  [EXTRACTED]
  components/HistoryModal.tsx → context/theme.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Industrial Design System Foundations** — design_industrial_verification_logic, design_graphite_pro_palette, design_scanning_typography, design_fluid_grid_warehouse_layout, design_tonal_elevation_borders [EXTRACTED 1.00]
- **Damage Lost Record Ingestion and Persistence Pipeline** — session_ses_fc33_dlr_workflow, session_ses_fc33_opensheet_catalog_lookup, session_ses_fc33_cloudinary_photo_pipeline, session_ses_fc33_supabase_dlr_records, session_ses_fc33_offline_queue_sync [EXTRACTED 1.00]
- **App Branding and Mascot Design** — assets_icon_app_icon, assets_icon_delivery_elephant_mascot, assets_icon_branding_visual_identity [INFERRED 0.85]
- **Splash Screen and Mascot Visual Identity** — assets_splash_png_splash_screen, assets_splash_png_delivery_elephant_mascot, assets_splash_png_branding_visual_identity [INFERRED 0.85]

## Communities (72 total, 41 thin omitted)

### Community 0 - "useTheme"
Cohesion: 0.08
Nodes (36): AppContent(), DAIZO_LOADING_ASSET, LocalAiFabModal(), LocalAiFabModalProps, Message, useGradualAnimation(), AiAssistantContext, AiAssistantContextType (+28 more)

### Community 1 - "dlr.ts"
Cohesion: 0.07
Nodes (50): DamageLostRecordScreen(), feedback(), formatRecordTime(), ProductCard(), ReasonPickerModal(), Step, STEP_LIST, askLocalHybridAssistant() (+42 more)

### Community 2 - "expo"
Cohesion: 0.05
Nodes (39): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, softwareKeyboardLayoutMode, splash, versionCode (+31 more)

### Community 3 - "devDependencies"
Cohesion: 0.05
Nodes (39): @babel/core, babel-preset-expo, eslint, eslint-config-expo, eslint-config-prettier, devDependencies, @babel/core, babel-preset-expo (+31 more)

### Community 4 - "patch-llama-rn.js"
Cohesion: 0.25
Nodes (7): downloadScript, { execSync }, fs, jniLibsDir, path, pluginPath, withLlamaRNPath

### Community 5 - "Industrial Verification Logic Design System"
Cohesion: 0.24
Nodes (11): Fluid Grid Warehouse Layout, Graphite Pro Color Palette, Industrial Verification Logic Design System, Scanning-Optimized Typography, Tonal Elevation and Solid Borders, Verification Component Patterns, Cloudinary Photo Compression and Upload Pipeline, Damage Lost Record (DLR) Multi-Step Flow (+3 more)

### Community 6 - "ScreenContent.tsx"
Cohesion: 0.24
Nodes (7): EditScreenInfo(), EditScreenInfoProps, styles, ScreenContent(), ScreenContentProps, styles, Modal()

### Community 7 - "rebox.ts"
Cohesion: 0.06
Nodes (84): cropImageToSquare(), failedItemImagesCache, getItemImageKey(), ItemImageCaptureModalContent(), ItemImagePreviewPayload, normalizeLookupCode(), playScanFeedback(), ReboxItemCard() (+76 more)

### Community 8 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): expo/tsconfig.base, compilerOptions, paths, strict, extends

### Community 11 - "metro.config.js"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 12 - "Android Adaptive Icon Asset"
Cohesion: 1.00
Nodes (3): Android Adaptive Icon Asset, Brand Identity & Visual Style, Delivery Elephant Mascot (Bag with "D")

### Community 13 - "Daiso Brand Logo"
Cohesion: 0.67
Nodes (3): Daiso Brand Identity, Daiso Brand Logo, Magenta Chevrons and Katakana Typography

### Community 14 - "Daizo Splash Image"
Cohesion: 0.67
Nodes (3): Daizo Mascot Character, Daizo Splash Image, Splash Screen Asset

### Community 15 - "Delivery Elephant Mascot"
Cohesion: 0.67
Nodes (3): Brand Identity & Visual Asset, Delivery Elephant Mascot, App Favicon

### Community 16 - "Delivery Elephant Mascot App Icon"
Cohesion: 1.00
Nodes (3): Delivery Elephant Mascot App Icon, Application Branding and Visual Identity, Delivery Elephant Mascot

### Community 17 - "Application Branding and Visual Identity"
Cohesion: 1.00
Nodes (3): Application Branding and Visual Identity, Delivery Elephant Mascot, Application Splash Screen

### Community 23 - "dependencies"
Cohesion: 0.18
Nodes (11): expo, expo-build-properties, @expo/vector-icons, lucide-react-native, dependencies, expo, expo-build-properties, @expo/vector-icons (+3 more)

### Community 24 - "New session - 2026-08-26T06:38:56.026Z"
Cohesion: 0.02
Nodes (90): Assistant (Build · Ox Alpha Free (Unlimited) · 10.0s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.3s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.4s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.5s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.7s), Assistant (Build · Ox Alpha Free (Unlimited) · 116.2s), Assistant (Build · Ox Alpha Free (Unlimited) · 117.9s), Assistant (Build · Ox Alpha Free (Unlimited) · 1189.1s) (+82 more)

### Community 29 - "App Releases, Supabase Updates & Notifications Guidelines"
Cohesion: 0.40
Nodes (4): 1. App Versioning Invariants, 2. Supabase `app_updates` Table Workflow, 3. Expo Notifications (SDK 56+), App Releases, Supabase Updates & Notifications Guidelines

### Community 31 - "appUpdateService.ts"
Cohesion: 0.21
Nodes (16): AppUpdateRecord, AppVersionInfo, checkForAppUpdate(), CheckUpdateOptions, compareSemver(), getApplication(), getCurrentAppVersion(), getNotifications() (+8 more)

### Community 33 - "TASK.md"
Cohesion: 0.25
Nodes (7): Step 2: Configure `app.json`, Step 3: Implement Model Download & Lifecycle Hook, Step 4: Implement Hybrid (Supabase + Local Storage) Service, Step 5: Implement FAB & Chat Modal Component with NativeWind, Step 6: Mount in Screen / Layout, Step 7: Prebuild and Compile, VERIFICATION CHECKLIST

### Community 41 - "scanningItem.tsx"
Cohesion: 0.07
Nodes (43): HistoryModal(), HistoryModalProps, Box, INITIAL_BOXES, Item, ProgressState, deduplicateBoxes(), failedItemImagesCache (+35 more)

### Community 51 - "DESIGN.md"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards & List Items, Chips & Badges, Colors, Components, Elevation & Depth, Inputs & Verification Fields (+4 more)

### Community 52 - "session-ses_fc33.md"
Cohesion: 0.50
Nodes (3): 1. Cloudinary: replace YOUR_PRESET first. Success = JSON with "secure_url", 2. Supabase read: table exists? (empty [] is fine, error = table missing), 3. Supabase insert: tests schema + RLS exactly like the app does

### Community 56 - "Receiving & Delivery Scanner App (Daizo) — v7.4"
Cohesion: 0.12
Nodes (16): 1. 📦 Receiving & Scanning Workflow, 2. 🗃️ Rebox & Packing Module (`Rebox Hub` & `ReboxScanner`), 3. ⚠️ Damage & Lost Record (DLR) Module, 4. 🤖 On-Device AI Assistant (Daizo), 5. 📜 Audit History & Session Recovery, 6. 🎨 Industrial UI Design System, 👤 Author & Portfolio, 🚦 Getting Started (+8 more)

### Community 70 - "🚀 What's New in v7.2"
Cohesion: 0.07
Nodes (27): 🔀 1. Conditional `CID NO` → `TRF NO` Lookup & Mode Toggle (`ScanningBox`), 🏪 1. Multi-Store Isolation for Damage Lost Record (DLR), 📦 1. TRF Items Lookup & Cross-Reference Modal, 🔍 2. Intelligent Bidirectional SKU ↔ UPC Lookup, 🖼️ 2. Interactive Large Image Preview & Gestures, 🗃️ 2. Rebox Hub, Per-Box Scanner & Store-Scoped Supabase Sync, 🌐 3. Conditional In-App Web Browser Search, 📸 3. Smart UPC Image Verification & Cloudinary Upload (`daisoimage`) (+19 more)

## Knowledge Gaps
- **320 isolated node(s):** `name`, `slug`, `version`, `favicon`, `tsconfigPaths` (+315 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`, `@react-native-async-storage/async-storage`, `expo-document-picker`, `expo-network`, `expo-image`, `expo-sharing`, `expo-status-bar`, `expo-application`, `react`, `expo-web-browser`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `expo-haptics`, `react-native-worklets`, `@react-navigation/native`, `nativewind`, `react-native-markdown-display`, `xlsx`, `expo-camera`, `react-native-screens`, `expo-file-system`, `react-native-keyboard-controller`, `papaparse`, `expo-splash-screen`, `@expo/ui`, `expo-image-manipulator`, `llama.rn`, `expo-notifications`, `react-native-svg`, `@react-navigation/bottom-tabs`, `expo-font`, `@react-navigation/stack`, `react-native`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _320 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useTheme` be split into smaller, more focused modules?**
  _Cohesion score 0.07993966817496229 - nodes in this community are weakly interconnected._
- **Should `dlr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07077922077922078 - nodes in this community are weakly interconnected._
- **Should `expo` be split into smaller, more focused modules?**
  _Cohesion score 0.05384615384615385 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `rebox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05937353903693315 - nodes in this community are weakly interconnected._