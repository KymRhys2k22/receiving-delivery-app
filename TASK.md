````markdown
# TASK: Integrate On-Device Local LLM (SmolLM2-360M) with llama.rn, Supabase, Local Storage (AsyncStorage), and NativeWind

## OBJECTIVE

Implement an on-device, offline-capable AI assistant in an Expo React Native application styled with NativeWind. The assistant is accessed via a bottom-right Floating Action Button (FAB) that triggers a slide-up chat modal. The assistant must combine and cross-reference data from **both Supabase (remote records) and Local Storage (client-side AsyncStorage records)**. It runs `SmolLM2-360M-Instruct` locally via `llama.rn` and adheres to a strict closed-book constraint.

---

## CONSTRAINTS & PREREQUISITES

1. **No Expo Go**: Relies on native C++ compilation (`llama.cpp`). Must use an Expo Dev Client (`npx expo run:android` / `npx expo run:ios`).
2. **Styling**: NativeWind (Tailwind CSS) utility classes via `className`. No inline `StyleSheet.create`.
3. **Data Sources**:
   - **Remote**: Supabase table queries.
   - **Local Storage**: `@react-native-async-storage/async-storage` (cached preferences, local drafts, offline records, or user profile).
4. **Model Specifications**:
   - Model: `SmolLM2-360M-Instruct-Q4_K_M.gguf` (~230 MB).
   - Format: Quantized GGUF.
   - Context Window: 2048 tokens.
   - Temperature: 0.1 (low temperature for strictly factual responses).
   - Chat Template: ChatML format (`<|im_start|>...<|im_end|>`).
5. **Hallucination Guardrail**: The system prompt must instruct the model to answer ONLY from the combined Supabase and Local Storage JSON payloads. If the requested information is absent from both, respond strictly with: `"Data not found in records."`

---

## STEP-BY-STEP IMPLEMENTATION PLAN

### Step 1: Install Required Dependencies

Install `llama.rn`, file management, storage, and build property packages:

```bash
npx expo install llama.rn expo-file-system @react-native-async-storage/async-storage expo-build-properties
```
````

---

### Step 2: Configure `app.json`

Verify plugins for `llama.rn` and `expo-build-properties` inside `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "llama.rn",
        {
          "enableEntitlements": true,
          "forceCxx20": true,
          "enableOpenCL": true
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 24
          },
          "ios": {
            "deploymentTarget": "15.1"
          }
        }
      ]
    ]
  }
}
```

---

### Step 3: Implement Model Download & Lifecycle Hook

Create `src/hooks/useLlamaModel.ts` to manage weights download, cache checking, and C++ context initialization:

```typescript
import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';

const MODEL_DOWNLOAD_URL =
  '[https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf)';
const MODEL_STORAGE_PATH = `${FileSystem.documentDirectory}smollm2-360m-instruct-q4_k_m.gguf`;

export function useLlamaModel() {
  const [context, setContext] = useState<LlamaContext null |>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Checking model file...');

  useEffect(() => {
    let isMounted = true;

    async function initializeEngine() {
      try {
        const fileInfo = await FileSystem.getInfoAsync(MODEL_STORAGE_PATH);

        if (!fileInfo.exists) {
          setStatusMessage('Downloading SmolLM2 (~230MB)...');
          const downloadResumable = FileSystem.createDownloadResumable(
            MODEL_DOWNLOAD_URL,
            MODEL_STORAGE_PATH,
            {},
            (progressEvent) => {
              if (progressEvent.totalBytesExpectedToWrite > 0) {
                const percent =
                  progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
                setDownloadProgress(percent);
              }
            }
          );
          await downloadResumable.downloadAsync();
        }

        setStatusMessage('Initializing engine...');
        const llamaInstance = await initLlama({
          model: MODEL_STORAGE_PATH,
          n_ctx: 2048,
          n_gpu_layers: 0,
          use_mlock: true,
        });

        if (isMounted) {
          setContext(llamaInstance);
          setIsReady(true);
          setStatusMessage('Ready');
        }
      } catch (error) {
        console.error('Failed to initialize local LLM:', error);
        if (isMounted) {
          setStatusMessage('Model load failed');
        }
      }
    }

    initializeEngine();

    return () => {
      isMounted = false;
      if (context) {
        context.release();
      }
    };
  }, []);

  return { context, isReady, downloadProgress, statusMessage };
}

```

---

### Step 4: Implement Hybrid (Supabase + Local Storage) Service

Create `src/services/localAiService.ts`. This service reads both remote Supabase rows and target keys from AsyncStorage, bundles them into structured context sections, and runs local streaming inference:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LlamaContext } from 'llama.rn';
import { supabase } from './supabaseClient'; // Adjust path to project's Supabase instance

interface QueryOptions {
  supabaseTable: string;
  supabaseFields?: string;
  supabaseLimit?: number;
  localStorageKeys?: string[]; // Specific keys to retrieve from AsyncStorage
  onStreamToken?: (token: string) => void;
}

export async function askLocalHybridAssistant(
  question: string,
  llamaContext: LlamaContext,
  options: QueryOptions
): Promise<string> {
  const {
    supabaseTable,
    supabaseFields = '*',
    supabaseLimit = 15,
    localStorageKeys = [],
    onStreamToken,
  } = options;

  // 1. Fetch remote Supabase rows
  const { data: supabaseData, error: supabaseError } = await supabase
    .from(supabaseTable)
    .select(supabaseFields)
    .limit(supabaseLimit);

  if (supabaseError) {
    console.warn('Supabase fetch error:', supabaseError.message);
  }

  // 2. Fetch local storage records
  const localDataMap: Record<string, any> = {};
  if (localStorageKeys.length > 0) {
    const keyPairs = await AsyncStorage.multiGet(localStorageKeys);
    keyPairs.forEach(([key, value]) => {
      if (value !== null) {
        try {
          localDataMap[key] = JSON.parse(value);
        } catch {
          localDataMap[key] = value;
        }
      }
    });
  }

  // 3. Format structured ChatML prompt with isolated data sections
  const prompt = `<|im_start|>system
You are a precise data assistant. Answer user questions using ONLY the data provided in the REMOTE DATABASE RECORDS and LOCAL APP STORAGE sections below.
Rules:
- Give concise, direct answers.
- Cross-reference both sources when relevant.
- Do NOT guess, infer, or pull information outside these records.
- If the answer cannot be determined from either section, reply strictly with: "Data not found in records."

--- REMOTE DATABASE RECORDS (Supabase) ---
${JSON.stringify(supabaseData || [], null, 2)}

--- LOCAL APP STORAGE (Device) ---
${JSON.stringify(localDataMap, null, 2)}
<|im_end|>
<|im_start|>user
${question}<|im_end|>
<|im_start|>assistant
`;

  // 4. Run local streaming inference
  let generatedAnswer = '';
  await llamaContext.completion(
    {
      prompt,
      n_predict: 128,
      temperature: 0.1,
      stop: ['<|im_start|>', '<|im_end|>', '<|endoftext|>'],
    },
    (tokenData) => {
      generatedAnswer += tokenData.token;
      if (onStreamToken) {
        onStreamToken(tokenData.token);
      }
    }
  );

  return generatedAnswer.trim();
}
```

---

### Step 5: Implement FAB & Chat Modal Component with NativeWind

Create `src/components/LocalAiFabModal.tsx`. Provides a bottom-right FAB, slide-up modal, download progress tracking, and conversation bubble list:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLlamaModel } from '../hooks/useLlamaModel';
import { askLocalHybridAssistant } from '../services/localAiService';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

interface LocalAiFabModalProps {
  tableName: string;
  selectFields?: string;
  localStorageKeys?: string[];
}

export function LocalAiFabModal({
  tableName,
  selectFields = '*',
  localStorageKeys = ['user_settings', 'cached_cart', 'offline_notes'],
}: LocalAiFabModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInferencing, setIsInferencing] = useState(false);

  const { context, isReady, downloadProgress, statusMessage } = useLlamaModel();

  const handleSend = async () => {
    if (!inputText.trim() || !context || isInferencing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText.trim(),
    };

    const aiMessageId = (Date.now() + 1).toString();
    const assistantMessagePlaceholder: Message = {
      id: aiMessageId,
      sender: 'assistant',
      text: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);
    setInputText('');
    setIsInferencing(true);

    try {
      await askLocalHybridAssistant(userMessage.text, context, {
        supabaseTable: tableName,
        supabaseFields: selectFields,
        localStorageKeys,
        onStreamToken: (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, text: msg.text + token } : msg
            )
          );
        },
      });
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, text: 'Error reading from data sources.' }
            : msg
        )
      );
    } finally {
      setIsInferencing(false);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <TouchableOpacity activeOpacity="{0.85}" onPress="{()"> setIsOpen(true)}
        className="absolute bottom-6 right-6 z-50 h-14 w-14 items-center justify-center rounded-full bg-sky-600 shadow-lg shadow-black/40 elevation-6"
      >
        <Text className="text-2xl text-white">💬</Text>
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal animationType="slide" transparent visible="{isOpen}">
        <KeyboardAvoidingView 'ios' 'padding' : ? behavior="{Platform.OS" className="flex-1 justify-end bg-black/50" undefined}>
          <View className="h-3/4 rounded-t-3xl bg-white p-4 shadow-xl dark:bg-slate-900">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <View>
                <Text className="text-base font-bold text-slate-900 dark:text-white">
                  Assistant (Supabase + Local)
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  {statusMessage}{' '}
                  {!isReady && downloadProgress > 0
                    ? `(${Math.round(downloadProgress * 100)}%)`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity onPress="{()"> setIsOpen(false)} className="p-2">
                <Text className="text-lg font-semibold text-slate-500 dark:text-slate-400">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Message List */}
            <FlatList data="{messages}" keyExtractor="{(item)"> item.id}
              className="my-3 flex-1"
              renderItem={({ item }) => {
                const isUser = item.sender === 'user';
                return (
                  <View ${ 'self-end 'self-start : ? bg-sky-600' bg-slate-100 className="{`my-1" dark:bg-slate-800' isUser max-w-[80%] p-3 rounded-2xl }`}>
                    <Text ${ 'text-slate-900 'text-white' : ? className="{`text-sm" dark:text-slate-100' isUser }`}>
                      {item.text || '...'}
                    </Text>
                  </View>
                );
              }}
            />

            {/* Input Bar */}
            <View className="flex-row items-center pt-2">
              <TextInput !isInferencing} && 'Ask 'Loading : ? about className="mr-2 flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" data...' editable="{isReady" local model...'} onChangeText="{setInputText}" or placeholder="{isReady" placeholderTextColor="#94a3b8" records value="{inputText}"/>
              <TouchableOpacity !inputText.trim() !inputText.trim()} !isReady ${ 'bg-sky-600' 'bg-slate-300 : ? className="{`rounded-full" dark:bg-slate-700' disabled="{!isReady" isInferencing onPress="{handleSend}" px-5 py-2.5 || }`}>
                {isInferencing ? (
                  <ActivityIndicator color="#ffffff" size="small"/>
                ) : (
                  <Text className="font-semibold text-white">Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

```

---

### Step 6: Mount in Screen / Layout

Mount the component and provide the target Supabase table along with the specific AsyncStorage keys your app uses:

```tsx
<LocalAiFabModal 'app_theme', 'offline_drafts']} localStorageKeys="{['user_profile'," selectFields="id, status, total, created_at" tableName="orders"/>

```

---

### Step 7: Prebuild and Compile

```bash
npx expo prebuild --clean
npx expo run:android
# or
npx expo run:ios

```

---

## VERIFICATION CHECKLIST

1. Verify `multiGet` correctly retrieves existing keys from `AsyncStorage` without parsing errors.
2. Confirm the prompt delivers clearly partitioned sections for both remote Supabase records and local device storage.
3. Verify queries concerning local storage values (e.g. offline drafts or client settings) are answered accurately.
4. Verify questions covering unrecorded information reliably return `"Data not found in records."`

```

```
