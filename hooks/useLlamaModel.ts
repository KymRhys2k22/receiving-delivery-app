import { useState, useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { isRunningInExpoGo } from 'expo';
import type { LlamaContext } from 'llama.rn';

const MODEL_DOWNLOAD_URL =
  'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf';
const MODEL_STORAGE_PATH = `${FileSystem.documentDirectory}smollm2-360m-instruct-q4_k_m.gguf`;

export function useLlamaModel() {
  const [context, setContext] = useState<LlamaContext | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Checking model file...');
  const contextRef = useRef<LlamaContext | null>(null);

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
                if (isMounted) {
                  setDownloadProgress(percent);
                }
              }
            }
          );
          await downloadResumable.downloadAsync();
        }

        if (!isMounted) return;

        if (isRunningInExpoGo()) {
          setStatusMessage('Native engine requires standalone APK build');
          return;
        }

        setStatusMessage('Initializing engine...');
        let llamaInstance: any = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { initLlama } = require('llama.rn');
          llamaInstance = await initLlama({
            model: MODEL_STORAGE_PATH,
            n_ctx: 2048,
            n_gpu_layers: 0,
            use_mlock: true,
          });
        } catch (llamaErr: any) {
          console.info('[useLlamaModel] initLlama unavailable in current APK:', llamaErr);
          if (isMounted) {
            setStatusMessage('Native engine requires new APK build');
          }
          return;
        }

        if (isMounted && llamaInstance) {
          contextRef.current = llamaInstance;
          setContext(llamaInstance);
          setIsReady(true);
          setStatusMessage('Ready');
        } else if (llamaInstance) {
          llamaInstance.release();
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
      if (contextRef.current) {
        try {
          contextRef.current.release();
        } catch {}
        contextRef.current = null;
      }
    };
  }, []);

  return { context, isReady, downloadProgress, statusMessage };
}
