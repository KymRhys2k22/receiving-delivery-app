# Graph Report - receiving-delivery-app  (2026-08-30)

## Corpus Check
- 43 files · ~76,512 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 305 nodes · 443 edges · 51 communities (22 shown, 29 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Application Core & Authentication
- Damage & Lost Record Workflow
- Expo App Configuration
- Development & Linting Tooling
- Package Manifest & Build Scripts
- Industrial UI & Architecture Specs
- Screen Layout Components
- Camera & Storage Dependencies
- TypeScript Configuration
- Navigation Back Button
- UI Action Button
- Metro Bundler & NativeWind Config
- Android Adaptive Icon Asset
- Daiso Brand Identity Asset
- Daizo Splash Screen Asset
- Favicon & Mascot Asset
- App Icon & Mascot Asset
- App Splash Screen Asset
- Navigation Header Button
- Tab Bar Icon Component
- ESLint Configuration
- CSS Environment Types
- expo Dependency
- expo-document-picker Dependency
- expo-file-system Dependency
- expo-font Dependency
- expo-haptics Dependency
- expo-image-manipulator Dependency
- expo-sharing Dependency
- expo-splash-screen Dependency
- expo-status-bar Dependency
- @expo/vector-icons Dependency
- lucide-react-native Dependency
- nativewind Dependency
- react Dependency
- react-native Dependency
- react-native-gesture-handler Dependency
- react-native-reanimated Dependency
- react-native-safe-area-context Dependency
- react-native-svg Dependency
- react-native-worklets Dependency
- @react-navigation/bottom-tabs Dependency
- @react-navigation/native Dependency
- @react-navigation/stack Dependency
- @supabase/supabase-js Dependency
- xlsx Dependency

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 23 edges
2. `DamageLostRecordScreen()` - 19 edges
3. `useAuth()` - 16 edges
4. `expo` - 15 edges
5. `processDlrSyncQueue()` - 11 edges
6. `scripts` - 9 edges
7. `loadDlrRecords()` - 6 edges
8. `upsertDlrRecord()` - 6 edges
9. `Industrial Verification Logic Design System` - 6 edges
10. `Damage Lost Record (DLR) Multi-Step Flow` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Damage Lost Record (DLR) Multi-Step Flow` --conceptually_related_to--> `Verification Component Patterns`  [INFERRED]
  session-ses_fc33.md → DESIGN.md
- `useIsNotSignedIn()` --calls--> `useAuth()`  [EXTRACTED]
  navigation/index.tsx → context/auth.tsx
- `useIsSignedIn()` --calls--> `useAuth()`  [EXTRACTED]
  navigation/index.tsx → context/auth.tsx
- `DamageLostRecordScreen()` --calls--> `useAuth()`  [EXTRACTED]
  screens/damageLostRecord.tsx → context/auth.tsx
- `TabBarIcon()` --calls--> `useTheme()`  [EXTRACTED]
  navigation/tab-navigator.tsx → context/theme.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Industrial Design System Foundations** — design_industrial_verification_logic, design_graphite_pro_palette, design_scanning_typography, design_fluid_grid_warehouse_layout, design_tonal_elevation_borders [EXTRACTED 1.00]
- **Damage Lost Record Ingestion and Persistence Pipeline** — session_ses_fc33_dlr_workflow, session_ses_fc33_opensheet_catalog_lookup, session_ses_fc33_cloudinary_photo_pipeline, session_ses_fc33_supabase_dlr_records, session_ses_fc33_offline_queue_sync [EXTRACTED 1.00]
- **App Branding and Mascot Design** — assets_icon_app_icon, assets_icon_delivery_elephant_mascot, assets_icon_branding_visual_identity [INFERRED 0.85]
- **Splash Screen and Mascot Visual Identity** — assets_splash_png_splash_screen, assets_splash_png_delivery_elephant_mascot, assets_splash_png_branding_visual_identity [INFERRED 0.85]

## Communities (51 total, 29 thin omitted)

### Community 0 - "Application Core & Authentication"
Cohesion: 0.08
Nodes (41): AuthContext, AuthContextType, AuthProvider(), useAuth(), ThemeContext, ThemeContextType, ThemeMode, ThemeProvider() (+33 more)

### Community 1 - "Damage & Lost Record Workflow"
Cohesion: 0.10
Nodes (41): DamageLostRecordScreen(), feedback(), formatRecordTime(), Step, STEP_LIST, buildDlrImageName(), buildSupabasePayload(), CLOUDINARY_CLOUD_NAME (+33 more)

### Community 2 - "Expo App Configuration"
Cohesion: 0.06
Nodes (33): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, splash, projectId, tsconfigPaths (+25 more)

### Community 3 - "Development & Linting Tooling"
Cohesion: 0.09
Nodes (23): @babel/core, babel-preset-expo, eslint, eslint-config-expo, eslint-config-prettier, devDependencies, @babel/core, babel-preset-expo (+15 more)

### Community 4 - "Package Manifest & Build Scripts"
Cohesion: 0.14
Nodes (13): main, name, private, scripts, android, eas-build-pre-install, format, ios (+5 more)

### Community 5 - "Industrial UI & Architecture Specs"
Cohesion: 0.24
Nodes (11): Fluid Grid Warehouse Layout, Graphite Pro Color Palette, Industrial Verification Logic Design System, Scanning-Optimized Typography, Tonal Elevation and Solid Borders, Verification Component Patterns, Cloudinary Photo Compression and Upload Pipeline, Damage Lost Record (DLR) Multi-Step Flow (+3 more)

### Community 6 - "Screen Layout Components"
Cohesion: 0.24
Nodes (7): EditScreenInfo(), EditScreenInfoProps, styles, ScreenContent(), ScreenContentProps, styles, Modal()

### Community 7 - "Camera & Storage Dependencies"
Cohesion: 0.22
Nodes (9): expo-camera, dependencies, expo-camera, papaparse, @react-native-async-storage/async-storage, react-native-screens, papaparse, @react-native-async-storage/async-storage (+1 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.33
Nodes (5): expo/tsconfig.base, compilerOptions, paths, strict, extends

### Community 10 - "UI Action Button"
Cohesion: 0.50
Nodes (3): Button, ButtonProps, styles

### Community 11 - "Metro Bundler & NativeWind Config"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 12 - "Android Adaptive Icon Asset"
Cohesion: 1.00
Nodes (3): Android Adaptive Icon Asset, Brand Identity & Visual Style, Delivery Elephant Mascot (Bag with "D")

### Community 13 - "Daiso Brand Identity Asset"
Cohesion: 0.67
Nodes (3): Daiso Brand Identity, Daiso Brand Logo, Magenta Chevrons and Katakana Typography

### Community 14 - "Daizo Splash Screen Asset"
Cohesion: 0.67
Nodes (3): Daizo Mascot Character, Daizo Splash Image, Splash Screen Asset

### Community 15 - "Favicon & Mascot Asset"
Cohesion: 0.67
Nodes (3): Brand Identity & Visual Asset, Delivery Elephant Mascot, App Favicon

### Community 16 - "App Icon & Mascot Asset"
Cohesion: 1.00
Nodes (3): Delivery Elephant Mascot App Icon, Application Branding and Visual Identity, Delivery Elephant Mascot

### Community 17 - "App Splash Screen Asset"
Cohesion: 1.00
Nodes (3): Application Branding and Visual Identity, Delivery Elephant Mascot, Application Splash Screen

## Knowledge Gaps
- **120 isolated node(s):** `name`, `slug`, `version`, `favicon`, `tsconfigPaths` (+115 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-sharing` connect `Expo App Configuration` to `Application Core & Authentication`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _120 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Application Core & Authentication` be split into smaller, more focused modules?**
  _Cohesion score 0.08299240210403273 - nodes in this community are weakly interconnected._
- **Should `Damage & Lost Record Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.09797979797979799 - nodes in this community are weakly interconnected._
- **Should `Expo App Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.06417112299465241 - nodes in this community are weakly interconnected._
- **Should `Development & Linting Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Package Manifest & Build Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._