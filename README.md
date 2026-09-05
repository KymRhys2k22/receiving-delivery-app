# Receiving & Delivery Scanner App (Daizo)

An industrial-grade, offline-first mobile application built with React Native and Expo for retail store receiving, carton/box verification, SKU barcode tallying, damage/loss claims (DLR), and on-device AI assistance.

---

## 📱 What is this App For?

In retail and warehouse logistics, receiving stock deliveries quickly and accurately is critical. This application replaces manual paper manifests and clunky handheld terminals with a modern, ruggedized smartphone scanner:

1. **Manifest Intake & Verification**: Import delivery manifests (CSV/Excel or Supabase) and scan incoming carton barcodes (CID) and individual product barcodes (SKU).
2. **Discrepancy Detection**: Instantly detects short shipments, overages, or unexpected items in real time with high-contrast visual cues and haptic alerts.
3. **Damage & Lost Record (DLR) Claims**: Document damaged, open, or missing inventory directly at the receiving dock, complete with step-by-step photographic evidence and defect categorization.
4. **Offline Local AI Assistant (Daizo)**: Ask questions about shipment manifests, remaining boxes, or inventory status completely offline using an on-device quantized LLM (`SmolLM2-360M`).
5. **Session History & Auditing**: Review past receiving batches, resume interrupted sessions, and sync records back to remote databases when network connectivity is available.

---

## 🚀 Key Features

### 1. 📦 Receiving & Scanning Workflow
- **Carton-Level Scanning (`ScanningBox`)**: Scan master carton IDs (CID) to verify total cartons received against the bill of lading.
- **Item-Level Scanning (`ScanningItem`)**: Scan individual item barcodes/SKUs with real-time counter incrementing (`Scanned / Expected`).
- **Fast Continuous Barcode Scanning**: Uses `expo-camera` with torch/flashlight control, audio feedback, and vibration haptics for noisy warehouse environments.
- **Manifest File Picker**: Pick and parse `.csv` or `.xlsx` delivery packing slips on the fly with `papaparse` and `xlsx`.

### 2. ⚠️ Damage & Lost Record (DLR) Module
- **Guided Defect Logging**: Classify issues by defect type (water damage, torn packaging, crushed carton, missing contents, etc.).
- **Camera Capture & Image Compression**: Capture mandatory damage photos, automatically compressed and stamped with tracking and metadata before uploading to Supabase Storage.
- **Catalog Lookup**: Scan damaged item barcodes to automatically pull description and details from the local/remote catalog.

### 3. 🤖 On-Device AI Assistant (Daizo)
- **100% Local Inference**: Runs `SmolLM2-360M-Instruct-Q4_K_M.gguf` on-device via `llama.rn` (native `llama.cpp` C++ engine).
- **Strict Closed-Book Guardrails**: Analyzes only the active scan session (`AsyncStorage`) and remote shipment data (`Supabase`). Will not hallucinate facts outside the loaded shipment records.
- **Floating Action Button (FAB)**: Accessible across any screen via a persistent center button or floating bubble.

### 4. 📜 Audit History & Session Recovery
- Automatically saves receiving runs to local persistent storage (`@react-native-async-storage/async-storage`).
- Browse previous receiving batches with timestamps, operator IDs, total items scanned, and discrepancy rates.
- Resume interrupted scan sessions without losing progress.

### 5. 🎨 Industrial UI Design System
- **Graphite Pro Theme**: High-contrast dark and light modes tailored for warehouse lighting and battery longevity on OLED screens.
- **Tailwind / NativeWind**: Strict utility-based design with 44px+ touch targets optimized for warehouse gloves.
- **Monospace Precision**: JetBrains Mono for SKUs, carton IDs, and tracking numbers to prevent mistaking `0` for `O` or `1` for `l`.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React Native 0.85](https://reactnative.dev/) / [Expo SDK 56](https://expo.dev/) (Dev Client) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS 3.4) |
| **Navigation** | [React Navigation 7](https://reactnavigation.org/) (Stack & Bottom Tabs) |
| **Local AI Engine**| [`llama.rn`](https://github.com/mybigday/llama.rn) (`llama.cpp` C++ bindings) |
| **AI Model** | `SmolLM2-360M-Instruct-Q4_K_M.gguf` (230 MB quantized GGUF) |
| **Database & Storage** | [Supabase](https://supabase.com/) (`@supabase/supabase-js`) |
| **Hardware APIs** | `expo-camera`, `expo-haptics`, `expo-file-system`, `expo-network` |
| **File Parsing** | `papaparse` (CSV), `xlsx` (Excel) |

---

## 📂 Project Structure

```
receiving-delivery-app/
├── assets/                 # App icons, splash screens, chatbot avatars, GGUF models
├── components/             # Reusable UI widgets & modal dialogs
│   ├── LocalAiFabModal.tsx # Daizo on-device AI chat modal
│   └── ...
├── context/                # React Context Providers
│   ├── aiAssistant.tsx     # Daizo AI state and chat management
│   ├── auth.tsx            # Operator credentials & store authentication
│   └── theme.tsx           # Dark / Light theme provider
├── navigation/             # Navigation stacks & bottom tab bar
│   ├── index.tsx           # Auth / Unauth root stack
│   └── tab-navigator.tsx   # Receiving, History, DLR, Settings tabs
├── screens/                # Main feature screens
│   ├── damageLostRecord.tsx# DLR defect reporting & photo proof
│   ├── login.tsx           # Operator sign-in & store selector
│   ├── one.tsx             # Receiving hub & manifest importer
│   ├── scanningBox.tsx     # Carton CID barcode scanner
│   ├── scanningItem.tsx    # Item SKU barcode scanner
│   ├── two.tsx             # Past scan history & auditing
│   └── three.tsx           # Settings, system info & OTA updates
├── services/               # Supabase queries, update checker, AI service
├── utils/                  # AsyncStorage keys, image compression, formatting
├── DESIGN.md               # Visual design tokens & brand guidelines
├── TASK.md                 # Architecture spec for local LLM & data flow
└── RELEASE.md              # Version changelog and commit notes
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
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
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

Developed by **Kym Rhys**  
🌐 **Portfolio Website**: [kym-rhys.vercel.app](https://kym-rhys.vercel.app/)  
GitHub: [@KymRhys2k22](https://github.com/KymRhys2k22)

