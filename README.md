# Receiving & Delivery Scanner App (Daizo) — v7.4

An industrial-grade, offline-first mobile application built with React Native and Expo for retail store receiving, carton/box verification, SKU barcode tallying, rebox packing & PDF manifest generation, damage/loss claims (DLR), and on-device AI assistance.

---

## 📱 What is this App For?

In retail and warehouse logistics, receiving stock deliveries quickly and accurately is critical. This application replaces manual paper manifests and clunky handheld terminals with a modern, ruggedized smartphone scanner:

1. **Manifest Intake & Verification**: Import delivery manifests (CSV/Excel or Supabase) and scan incoming carton barcodes (`CID NO` / `TRF NO`) and individual product barcodes (`SKU` / `UPC`).
2. **Conditional CID / TRF Item Cross-Reference**: Instantly inspect items inside any box starting with `CID NO` lookup and automatically falling back to `TRF NO` when needed, or manually toggle between `CID NO` and `TRF NO`.
3. **Rebox & Packing Hub + PDF Export**: Register box numbers before scanning, pack items with automatic OpenSheet & manifest catalog lookup, upload missing item photos to Cloudinary (`products/{UPC}`), hold 3 seconds to delete entries, and export printable PDF reports with embedded product photos.
4. **Discrepancy Detection**: Instantly detects short shipments, overages, or unexpected items in real time with high-contrast visual cues and haptic alerts.
5. **Damage & Lost Record (DLR) Claims**: Document damaged, open, or missing inventory directly at the receiving dock, complete with store-isolated cloud sync and step-by-step photographic evidence.
6. **Offline Local AI Assistant (Daizo)**: Ask questions about shipment manifests, SKU ↔ UPC lookups, remaining boxes, or inventory status completely offline using an on-device quantized LLM (`SmolLM2-360M`).
7. **Session History & Auditing**: Review past receiving batches via the History modal, resume interrupted sessions, and sync records back to remote databases when network connectivity is available.

---

## 🚀 Key Features

### 1. 📦 Receiving & Scanning Workflow
- **Carton-Level Scanning (`ScanningBox`)**: Scan master carton IDs (`CID NO`) or transfer numbers (`TRF NO`) to verify total cartons received against the bill of lading.
- **Conditional `CID NO` → `TRF NO` Lookup & Toggle**: Tap any box or open the **CID / TRF** lookup modal to view expected items. Defaults to `CID NO` lookup first and automatically switches to `TRF NO` if no `CID NO` match is found, with a segmented **`CID NO` | `TRF NO`** toggle button for manual switching.
- **Item-Level Scanning (`ScanningItem`)**: Scan individual item barcodes/SKUs with leading-zero normalization (`normalizeLookupCode`) and real-time counter incrementing (`Scanned / Expected`).
- **Interactive Image Zoom & Web Search**: Pinch-to-zoom (`1.0x–4.0x`) and pan product photos, or launch an in-app Google Images search (`expo-web-browser`) when no product photo exists on CDN.
- **Camera & Bluetooth Scanner Support**: Uses `expo-camera` with lifecycle self-healing, horizontal swipe tab switching, and a dedicated Bluetooth physical scanner keyboard-buffer toggle.

### 2. 🗃️ Rebox & Packing Module (`Rebox Hub` & `ReboxScanner`)
- **Box-First UX Workflow**: Dedicated Box Selection & Registration Hub (`screens/two.tsx`) displays active box cards, item/unit KPIs, and store badges before launching the dedicated item scanner (`screens/reboxScanner.tsx`).
- **OpenSheet & Manifest Catalog Resolution**: Automatically resolves `DESCRIPTION`, `SKU`, and `UPC` from the cached OpenSheet catalog and uploaded item manifests (`utils/rebox.ts` & `utils/dlr.ts`).
- **Smart Pre-Upload Image Check & Cloudinary Upload**: Checks Daiso CDN and Cloudinary (`products/{UPC}`) before prompting for an upload; if missing, operators can capture/upload a 1:1 product image named after the `UPC` using `EXPO_CLOUDINARY_UPLOAD_PRESET=daisoimage`.
- **3-Second Hold-to-Delete**: Press and hold any Rebox item card for `3.0s` (with live visual progress bar and haptic feedback) to prevent accidental deletions while keeping cleanup fast on the dock.
- **PDF Report Export with Embedded Photos**: Pure TypeScript PDF 1.4 generator (`generateReboxPdf` / `downloadReboxPdf`) embeds normalized product JPEG thumbnails, KPI summary cards, and box tables—saving directly to Android `Documents` via Storage Access Framework (`Save to Phone`) or sharing via the native OS sheet (`Share PDF`).
- **Multi-Store Supabase Sync**: Stores records in `public.rebox_items` scoped by `storeCode` with offline queue fallback.

### 3. ⚠️ Damage & Lost Record (DLR) Module
- **Guided Defect Logging**: Classify issues by defect type (water damage, torn packaging, crushed carton, missing contents, etc.) with strict multi-store isolation (`storeCode` / `store.json`).
- **Camera Capture & Image Compression**: Capture mandatory damage photos, automatically compressed and uploaded to Cloudinary / Supabase.
- **Catalog Lookup**: Scan damaged item barcodes to automatically pull description and details from the OpenSheet/local catalog.

### 4. 🤖 On-Device AI Assistant (Daizo)
- **100% Local Inference**: Runs `SmolLM2-360M-Instruct-Q4_K_M.gguf` on-device via `llama.rn` (native `llama.cpp` C++ engine).
- **Strict Closed-Book Guardrails & Bidirectional SKU ↔ UPC Q&A**: Answers Taglish and English queries strictly from active scan sessions, catalog records, and store DLR data without leaking internal cost margins.
- **Floating Center Tab Action**: Accessible across the main tab bar via the center Daizo assistant button.

### 5. 📜 Audit History & Session Recovery
- Accessible directly from the Receiving Hub (`screens/one.tsx`) via `components/HistoryModal.tsx`.
- Browse previous receiving batches with timestamps, operator IDs, total boxes/items scanned, and resume interrupted scan sessions without losing progress.

### 6. 🎨 Industrial UI Design System
- **Graphite Pro Theme**: High-contrast dark and light modes tailored for warehouse lighting and battery longevity on OLED screens.
- **Safe-Area & Edge-to-Edge Precision**: Dynamic safe-area inset handling (`useSafeAreaInsets` + translucent navigation/status bar providers) prevents bottom padding gaps above Android gesture/3-button navigation bars.
- **Monospace Precision**: JetBrains Mono for SKUs, UPCs, carton CIDs, and TRF numbers to prevent mistaking `0` for `O` or `1` for `l`.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React Native 0.85.3](https://reactnative.dev/) / [Expo SDK 56](https://expo.dev/) (Dev Client) |
| **Language** | [TypeScript 6.0](https://www.typescriptlang.org/) |
| **Styling** | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS 3.4) |
| **Navigation** | [React Navigation 7](https://reactnavigation.org/) (Stack & Safe-Area Bottom Tabs) |
| **Local AI Engine** | [`llama.rn`](https://github.com/mybigday/llama.rn) (`llama.cpp` C++ bindings) |
| **AI Model** | `SmolLM2-360M-Instruct-Q4_K_M.gguf` (quantized GGUF) |
| **Database & Cloud** | [Supabase](https://supabase.com/) (`@supabase/supabase-js`), Cloudinary CDN, OpenSheet Catalog |
| **Hardware & Media APIs** | `expo-camera`, `expo-image`, `expo-image-manipulator`, `expo-haptics`, `expo-file-system`, `expo-sharing`, `expo-web-browser` |
| **File Parsing & Export** | `papaparse` (CSV), `xlsx` (Excel), Custom Binary PDF 1.4 Engine (`utils/rebox.ts`) |

---

## 📂 Project Structure

```
receiving-delivery-app/
├── assets/                   # App icons, splash screens, Daizo avatars, GGUF models
├── components/               # Reusable UI widgets & modal dialogs
│   ├── HistoryModal.tsx      # Past receiving session audit & resume modal
│   ├── LocalAiFabModal.tsx   # Daizo on-device AI chat modal
│   └── ...
├── context/                  # React Context Providers
│   ├── aiAssistant.tsx       # Daizo AI state and chat management
│   ├── auth.tsx              # Operator credentials & store authentication
│   └── theme.tsx             # Dark / Light / System theme provider
├── navigation/               # Navigation stacks & safe-area bottom tab bar
│   ├── index.tsx             # Root stack (Tabs, ScanningBox, ScanningItem, ReboxScanner, DLR)
│   └── tab-navigator.tsx     # Receiving, Rebox, Daizo AI, DLR, Settings tabs
├── screens/                  # Main feature screens
│   ├── damageLostRecord.tsx  # DLR defect reporting & photo proof
│   ├── login.tsx             # Operator sign-in & store code validator
│   ├── one.tsx               # Receiving hub, manifest importer & History trigger
│   ├── reboxScanner.tsx      # Dedicated per-box Rebox barcode scanner & PDF export
│   ├── scanningBox.tsx       # Carton CID/TRF scanner & conditional CID → TRF item lookup
│   ├── scanningItem.tsx      # Item SKU/UPC barcode scanner & 1:1 photo uploader
│   ├── two.tsx               # Rebox Hub (box registration, catalog sync, All-Boxes PDF export)
│   └── three.tsx             # Terminal settings, theme switcher & OTA update checker
├── services/                 # App update checker (semver) & local AI inference services
├── utils/                    # Core domain & persistence utilities
│   ├── dlr.ts                # Supabase client, OpenSheet catalog cache, DLR & Cloudinary helpers
│   ├── rebox.ts              # Rebox storage/Supabase sync, UPC photo check/upload & PDF 1.4 generator
│   └── storage.ts            # AsyncStorage keys, manifest interfaces & session history helpers
├── DESIGN.md                 # Visual design tokens & brand guidelines
├── TASK.md                   # Architecture spec for local LLM & data flow
└── RELEASE.md                # Version changelog, git tag & Supabase release instructions
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or v20 recommended)
- Android SDK (for physical device or Android emulator testing)
- Xcode (macOS only, for iOS builds)
- Expo Dev Client (Note: `llama.rn` requires native code and cannot run in Expo Go)

### Installation
1. Clone repository:
   ```bash
   git clone https://github.com/KymRhys2k22/receiving-delivery-app.git
   cd receiving-delivery-app
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Configure Environment:
   Copy `.env.example` to `.env` and fill in your Supabase and Cloudinary credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-dlr-preset
   EXPO_CLOUDINARY_UPLOAD_PRESET=daisoimage
   ```

4. Run the Dev Client:
   ```bash
   # Android
   npx expo run:android

   # iOS
   npx expo run:ios
   ```

---

## 🧪 Testing on Physical Devices
To test with Android wireless ADB and `agent-device`:
```bash
adb connect <device-ip>:<port>
npx expo start
```

---

## 👤 Author & Portfolio

Developed by **Kym Rhys Mallari**  
🌐 **Portfolio Website**: [kym-rhys.vercel.app](https://kym-rhys.vercel.app/)  
GitHub: [@KymRhys2k22](https://github.com/KymRhys2k22)
