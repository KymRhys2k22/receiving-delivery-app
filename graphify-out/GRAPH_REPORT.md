# Graph Report - receiving-delivery-app  (2026-09-05)

## Corpus Check
- 49 files · ~137,962 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 741 edges · 70 communities (30 shown, 40 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7cc41169`
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
- expo-document-picker
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
- expo-file-system
- dependencies
- New session - 2026-08-26T06:38:56.026Z
- appUpdateService.ts
- expo-camera
- expo-image
- expo-sharing
- App Releases, Supabase Updates & Notifications Guidelines
- expo-status-bar
- @expo/vector-icons
- expo-network
- TASK.md
- react
- @react-native-async-storage/async-storage
- react-native-gesture-handler
- react-native-reanimated
- react-native-safe-area-context
- expo-haptics
- react-native-worklets
- expo-font
- @react-navigation/native
- nativewind
- @supabase/supabase-js
- xlsx
- DESIGN.md
- session-ses_fc33.md
- rules/graphify.md
- workflows/graphify.md
- expo-build-properties
- Receiving & Delivery Scanner App (Daizo)
- react-native-screens
- localAiService.ts
- lucide-react-native
- papaparse
- react-native
- @expo/ui
- expo-image-manipulator
- expo-splash-screen
- llama.rn
- expo-notifications
- react-native-markdown-display
- @react-navigation/stack
- 🚀 What's New in v7.1

## God Nodes (most connected - your core abstractions)
1. `New session - 2026-08-26T06:38:56.026Z` - 90 edges
2. `useTheme()` - 28 edges
3. `useAuth()` - 18 edges
4. `DamageLostRecordScreen()` - 17 edges
5. `expo` - 15 edges
6. `scripts` - 10 edges
7. `processDlrSyncQueue()` - 9 edges
8. `LocalAiFabModal()` - 8 edges
9. `checkForAppUpdate()` - 8 edges
10. `Receiving & Delivery Scanner App (Daizo)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ProductCard()` --calls--> `useTheme()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/theme.tsx
- `ReasonPickerModal()` --calls--> `useTheme()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/theme.tsx
- `Damage Lost Record (DLR) Multi-Step Flow` --conceptually_related_to--> `Verification Component Patterns`  [INFERRED]
  session-ses_fc33.md → DESIGN.md
- `AppContent()` --calls--> `useTheme()`  [EXTRACTED]
  App.tsx → context/theme.tsx
- `LocalAiFabModal()` --calls--> `useAuth()`  [EXTRACTED]
  components/LocalAiFabModal.tsx → context/auth.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Industrial Design System Foundations** — design_industrial_verification_logic, design_graphite_pro_palette, design_scanning_typography, design_fluid_grid_warehouse_layout, design_tonal_elevation_borders [EXTRACTED 1.00]
- **Damage Lost Record Ingestion and Persistence Pipeline** — session_ses_fc33_dlr_workflow, session_ses_fc33_opensheet_catalog_lookup, session_ses_fc33_cloudinary_photo_pipeline, session_ses_fc33_supabase_dlr_records, session_ses_fc33_offline_queue_sync [EXTRACTED 1.00]
- **App Branding and Mascot Design** — assets_icon_app_icon, assets_icon_delivery_elephant_mascot, assets_icon_branding_visual_identity [INFERRED 0.85]
- **Splash Screen and Mascot Visual Identity** — assets_splash_png_splash_screen, assets_splash_png_delivery_elephant_mascot, assets_splash_png_branding_visual_identity [INFERRED 0.85]

## Communities (70 total, 40 thin omitted)

### Community 0 - "useTheme"
Cohesion: 0.09
Nodes (32): AiAssistantContext, AiAssistantContextType, AiAssistantProvider(), useAiAssistant(), AuthContext, AuthContextType, AuthProvider(), useAuth() (+24 more)

### Community 1 - "dlr.ts"
Cohesion: 0.09
Nodes (42): DamageLostRecordScreen(), feedback(), formatRecordTime(), ProductCard(), ReasonPickerModal(), Step, STEP_LIST, buildDlrImageName() (+34 more)

### Community 2 - "expo"
Cohesion: 0.06
Nodes (38): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, softwareKeyboardLayoutMode, splash, versionCode (+30 more)

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
Cohesion: 0.22
Nodes (9): expo, expo-application, dependencies, expo, expo-application, react-native-svg, @react-navigation/bottom-tabs, react-native-svg (+1 more)

### Community 24 - "New session - 2026-08-26T06:38:56.026Z"
Cohesion: 0.02
Nodes (90): Assistant (Build · Ox Alpha Free (Unlimited) · 10.0s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.3s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.4s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.5s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.7s), Assistant (Build · Ox Alpha Free (Unlimited) · 116.2s), Assistant (Build · Ox Alpha Free (Unlimited) · 117.9s), Assistant (Build · Ox Alpha Free (Unlimited) · 1189.1s) (+82 more)

### Community 25 - "appUpdateService.ts"
Cohesion: 0.18
Nodes (18): AppContent(), AppUpdateRecord, AppVersionInfo, checkForAppUpdate(), CheckUpdateOptions, compareSemver(), getApplication(), getCurrentAppVersion() (+10 more)

### Community 29 - "App Releases, Supabase Updates & Notifications Guidelines"
Cohesion: 0.40
Nodes (4): 1. App Versioning Invariants, 2. Supabase `app_updates` Table Workflow, 3. Expo Notifications (SDK 56+), App Releases, Supabase Updates & Notifications Guidelines

### Community 33 - "TASK.md"
Cohesion: 0.25
Nodes (7): Step 2: Configure `app.json`, Step 3: Implement Model Download & Lifecycle Hook, Step 4: Implement Hybrid (Supabase + Local Storage) Service, Step 5: Implement FAB & Chat Modal Component with NativeWind, Step 6: Mount in Screen / Layout, Step 7: Prebuild and Compile, VERIFICATION CHECKLIST

### Community 51 - "DESIGN.md"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards & List Items, Chips & Badges, Colors, Components, Elevation & Depth, Inputs & Verification Fields (+4 more)

### Community 52 - "session-ses_fc33.md"
Cohesion: 0.50
Nodes (3): 1. Cloudinary: replace YOUR_PRESET first. Success = JSON with "secure_url", 2. Supabase read: table exists? (empty [] is fine, error = table missing), 3. Supabase insert: tests schema + RLS exactly like the app does

### Community 56 - "Receiving & Delivery Scanner App (Daizo)"
Cohesion: 0.12
Nodes (15): 1. 📦 Receiving & Scanning Workflow, 2. ⚠️ Damage & Lost Record (DLR) Module, 3. 🤖 On-Device AI Assistant (Daizo), 4. 📜 Audit History & Session Recovery, 5. 🎨 Industrial UI Design System, 👤 Author & Portfolio, 🚦 Getting Started, Installation (+7 more)

### Community 58 - "localAiService.ts"
Cohesion: 0.10
Nodes (32): DAIZO_LOADING_ASSET, LocalAiFabModal(), LocalAiFabModalProps, Message, useLlamaModel(), Box, INITIAL_BOXES, Item (+24 more)

### Community 70 - "🚀 What's New in v7.1"
Cohesion: 0.14
Nodes (13): 🏪 1. Multi-Store Isolation for Damage Lost Record (DLR), 🔍 2. Intelligent Bidirectional SKU ↔ UPC Lookup, 📱 3. Standalone APK Keyboard & Modal UI Fix, 🔄 4. Semantic Versioning in App Update Service, 🖼️ 5. `expo-image` Named Import Fix, 🎨 6. Assistant Branding & UI Polish, 🛡️ 7. ThemeProvider Mount Safety & LogBox Cleanup, Commit Scope & Modified Files (+5 more)

## Knowledge Gaps
- **288 isolated node(s):** `name`, `slug`, `version`, `favicon`, `tsconfigPaths` (+283 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`, `expo-document-picker`, `expo-file-system`, `expo-camera`, `expo-image`, `expo-sharing`, `expo-status-bar`, `@expo/vector-icons`, `expo-network`, `react`, `@react-native-async-storage/async-storage`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `expo-haptics`, `react-native-worklets`, `expo-font`, `@react-navigation/native`, `nativewind`, `@supabase/supabase-js`, `xlsx`, `expo-build-properties`, `react-native-screens`, `lucide-react-native`, `papaparse`, `react-native`, `@expo/ui`, `expo-image-manipulator`, `expo-splash-screen`, `llama.rn`, `expo-notifications`, `react-native-markdown-display`, `@react-navigation/stack`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `New session - 2026-08-26T06:38:56.026Z` connect `New session - 2026-08-26T06:38:56.026Z` to `session-ses_fc33.md`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _288 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useTheme` be split into smaller, more focused modules?**
  _Cohesion score 0.08599290780141844 - nodes in this community are weakly interconnected._
- **Should `dlr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._
- **Should `expo` be split into smaller, more focused modules?**
  _Cohesion score 0.0553306342780027 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._