# Graph Report - receiving-delivery-app  (2026-09-04)

## Corpus Check
- 41 files · ~84,483 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 451 nodes · 596 edges · 62 communities (27 shown, 35 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c505aa59`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useTheme
- dlr.ts
- expo
- devDependencies
- expo-document-picker
- Industrial Verification Logic Design System
- ScreenContent.tsx
- dependencies
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
- expo-camera
- New session - 2026-08-26T06:38:56.026Z
- appUpdateService.ts
- expo-haptics
- scripts
- expo-sharing
- App Releases, Supabase Updates & Notifications Guidelines
- expo-status-bar
- @expo/vector-icons
- expo-network
- nativewind
- react
- @react-native-async-storage/async-storage
- react-native-gesture-handler
- react-native-reanimated
- react-native-safe-area-context
- react-native-svg
- react-native-worklets
- @react-navigation/bottom-tabs
- @react-navigation/native
- @react-navigation/stack
- @supabase/supabase-js
- xlsx
- DESIGN.md
- session-ses_fc33.md
- rules/graphify.md
- workflows/graphify.md
- expo-font
- react-native-screens
- expo-notifications
- lucide-react-native
- papaparse
- react-native

## God Nodes (most connected - your core abstractions)
1. `New session - 2026-08-26T06:38:56.026Z` - 90 edges
2. `useTheme()` - 25 edges
3. `useAuth()` - 16 edges
4. `DamageLostRecordScreen()` - 16 edges
5. `expo` - 15 edges
6. `scripts` - 9 edges
7. `processDlrSyncQueue()` - 9 edges
8. `android` - 6 edges
9. `checkForAppUpdate()` - 6 edges
10. `Components` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ProductCard()` --calls--> `useTheme()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/theme.tsx
- `ReasonPickerModal()` --calls--> `useTheme()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/theme.tsx
- `Damage Lost Record (DLR) Multi-Step Flow` --conceptually_related_to--> `Verification Component Patterns`  [INFERRED]
  session-ses_fc33.md → DESIGN.md
- `useIsNotSignedIn()` --calls--> `useAuth()`  [EXTRACTED]
  navigation/index.tsx → context/auth.tsx
- `useIsSignedIn()` --calls--> `useAuth()`  [EXTRACTED]
  navigation/index.tsx → context/auth.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Industrial Design System Foundations** — design_industrial_verification_logic, design_graphite_pro_palette, design_scanning_typography, design_fluid_grid_warehouse_layout, design_tonal_elevation_borders [EXTRACTED 1.00]
- **Damage Lost Record Ingestion and Persistence Pipeline** — session_ses_fc33_dlr_workflow, session_ses_fc33_opensheet_catalog_lookup, session_ses_fc33_cloudinary_photo_pipeline, session_ses_fc33_supabase_dlr_records, session_ses_fc33_offline_queue_sync [EXTRACTED 1.00]
- **App Branding and Mascot Design** — assets_icon_app_icon, assets_icon_delivery_elephant_mascot, assets_icon_branding_visual_identity [INFERRED 0.85]
- **Splash Screen and Mascot Visual Identity** — assets_splash_png_splash_screen, assets_splash_png_delivery_elephant_mascot, assets_splash_png_branding_visual_identity [INFERRED 0.85]

## Communities (62 total, 35 thin omitted)

### Community 0 - "useTheme"
Cohesion: 0.08
Nodes (44): AppContent(), AuthContext, AuthContextType, AuthProvider(), useAuth(), ThemeContext, ThemeContextType, ThemeMode (+36 more)

### Community 1 - "dlr.ts"
Cohesion: 0.08
Nodes (45): DamageLostRecordScreen(), feedback(), formatRecordTime(), ProductCard(), ReasonPickerModal(), Step, STEP_LIST, buildDlrImageName() (+37 more)

### Community 2 - "expo"
Cohesion: 0.06
Nodes (37): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, splash, versionCode, projectId (+29 more)

### Community 3 - "devDependencies"
Cohesion: 0.09
Nodes (23): @babel/core, babel-preset-expo, eslint, eslint-config-expo, eslint-config-prettier, devDependencies, @babel/core, babel-preset-expo (+15 more)

### Community 5 - "Industrial Verification Logic Design System"
Cohesion: 0.24
Nodes (11): Fluid Grid Warehouse Layout, Graphite Pro Color Palette, Industrial Verification Logic Design System, Scanning-Optimized Typography, Tonal Elevation and Solid Borders, Verification Component Patterns, Cloudinary Photo Compression and Upload Pipeline, Damage Lost Record (DLR) Multi-Step Flow (+3 more)

### Community 6 - "ScreenContent.tsx"
Cohesion: 0.24
Nodes (7): EditScreenInfo(), EditScreenInfoProps, styles, ScreenContent(), ScreenContentProps, styles, Modal()

### Community 7 - "dependencies"
Cohesion: 0.22
Nodes (9): expo, expo-application, expo-image-manipulator, expo-splash-screen, dependencies, expo, expo-application, expo-image-manipulator (+1 more)

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

### Community 24 - "New session - 2026-08-26T06:38:56.026Z"
Cohesion: 0.02
Nodes (90): Assistant (Build · Ox Alpha Free (Unlimited) · 10.0s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.3s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.4s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.5s), Assistant (Build · Ox Alpha Free (Unlimited) · 10.7s), Assistant (Build · Ox Alpha Free (Unlimited) · 116.2s), Assistant (Build · Ox Alpha Free (Unlimited) · 117.9s), Assistant (Build · Ox Alpha Free (Unlimited) · 1189.1s) (+82 more)

### Community 25 - "appUpdateService.ts"
Cohesion: 0.21
Nodes (12): AppUpdateRecord, AppVersionInfo, CheckUpdateOptions, getApplication(), getCurrentAppVersion(), getNotifications(), LAST_NOTIFIED_VERSION_KEY, NOTE: "App Up to Date" alerts are ONLY shown if isManual === true (user clicked… (+4 more)

### Community 27 - "scripts"
Cohesion: 0.14
Nodes (13): main, name, private, scripts, android, eas-build-pre-install, format, ios (+5 more)

### Community 29 - "App Releases, Supabase Updates & Notifications Guidelines"
Cohesion: 0.40
Nodes (4): 1. App Versioning Invariants, 2. Supabase `app_updates` Table Workflow, 3. Expo Notifications (SDK 56+), App Releases, Supabase Updates & Notifications Guidelines

### Community 51 - "DESIGN.md"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards & List Items, Chips & Badges, Colors, Components, Elevation & Depth, Inputs & Verification Fields (+4 more)

### Community 52 - "session-ses_fc33.md"
Cohesion: 0.50
Nodes (3): 1. Cloudinary: replace YOUR_PRESET first. Success = JSON with "secure_url", 2. Supabase read: table exists? (empty [] is fine, error = table missing), 3. Supabase insert: tests schema + RLS exactly like the app does

## Knowledge Gaps
- **240 isolated node(s):** `name`, `slug`, `version`, `favicon`, `tsconfigPaths` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `New session - 2026-08-26T06:38:56.026Z` connect `New session - 2026-08-26T06:38:56.026Z` to `session-ses_fc33.md`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `expo-document-picker`, `expo-file-system`, `expo-camera`, `expo-haptics`, `scripts`, `expo-sharing`, `expo-status-bar`, `@expo/vector-icons`, `expo-network`, `nativewind`, `react`, `@react-native-async-storage/async-storage`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-svg`, `react-native-worklets`, `@react-navigation/bottom-tabs`, `@react-navigation/native`, `@react-navigation/stack`, `@supabase/supabase-js`, `xlsx`, `expo-font`, `react-native-screens`, `expo-notifications`, `lucide-react-native`, `papaparse`, `react-native`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useTheme` be split into smaller, more focused modules?**
  _Cohesion score 0.07782898105478751 - nodes in this community are weakly interconnected._
- **Should `dlr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07993197278911565 - nodes in this community are weakly interconnected._
- **Should `expo` be split into smaller, more focused modules?**
  _Cohesion score 0.05689900426742532 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._