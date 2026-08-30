import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCircle,
  X,
  AlertTriangle,
  Scan,
  Package,
  ChevronDown,
  RefreshCw,
  Flashlight,
  Camera,
  CloudUpload,
  WifiOff,
  RotateCcw,
  Search,
  CircleCheck,
  ClipboardList,
  Trash2,
  Plus,
  Minus,
  ExternalLink,
  Globe,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/theme';
import {
  DEFECT_REASONS,
  PHOTO_STEPS,
  buildSupabasePayload,
  buildDlrImageName,
  compressImage,
  createDlrId,
  fetchCatalog,
  getPendingSyncCount,
  loadDlrRecords,
  lookupProduct,
  processDlrSyncQueue,
  saveDlrRecords,
  supabase,
  upsertDlrRecord,
  uploadToCloudinary,
  type DLRLocalRecord,
  type DLRPhotoKey,
  type DLRStatus,
  type ProductItem,
} from '../utils/dlr';

const feedback = async (type: 'success' | 'warning' | 'error') => {
  try {
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const configs =
          type === 'success'
            ? [{ freq: 1200, at: 0, dur: 0.12 }]
            : type === 'warning'
              ? [
                  { freq: 680, at: 0, dur: 0.08 },
                  { freq: 680, at: 0.11, dur: 0.08 },
                ]
              : [{ freq: 260, at: 0, dur: 0.25 }];
        configs.forEach(({ freq, at, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type === 'error' ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
          gain.gain.setValueAtTime(0.4, ctx.currentTime + at);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + at);
          osc.stop(ctx.currentTime + at + dur);
        });
      }
    } catch {}
  }
};

type Step = 'SCAN' | 'DETAILS' | 'PHOTOS' | 'SUBMIT';

const STEP_LIST: { key: Step; label: string }[] = [
  { key: 'SCAN', label: 'Scan' },
  { key: 'DETAILS', label: 'Details' },
  { key: 'PHOTOS', label: 'Photos' },
  { key: 'SUBMIT', label: 'Submit' },
];

function StepIndicator({
  current,
  textPrimaryClass,
  textSecondaryClass,
}: {
  current: Step;
  textPrimaryClass: string;
  textSecondaryClass: string;
}) {
  const activeIndex = STEP_LIST.findIndex((s) => s.key === current);
  return (
    <View className="flex-row items-center justify-between px-5 py-2.5">
      {STEP_LIST.map((stepItem, index) => {
        const isActive = index === activeIndex;
        const isDone = index < activeIndex;
        return (
          <View key={stepItem.key} className="flex-1 flex-row items-center">
            <View
              className={`h-7 w-7 items-center justify-center rounded-full border ${
                isActive || isDone ? 'border-[#e5005c]' : 'border-[#3f3f46]'
              } ${isActive || isDone ? 'bg-[#e5005c]' : 'bg-transparent'}`}>
              <Text
                className={`font-jetbrains text-[10px] font-bold ${
                  isActive || isDone ? 'text-[#ffffff]' : 'text-[#71717a]'
                }`}>
                {index + 1}
              </Text>
            </View>
            <Text
              className={`ml-1 font-jetbrains text-[9px] font-bold uppercase ${
                isActive ? 'text-[#e5005c]' : isDone ? textPrimaryClass : textSecondaryClass
              }`}>
              {stepItem.label}
            </Text>
            {index < STEP_LIST.length - 1 && (
              <View
                className={`mx-1.5 h-px flex-1 ${isDone ? 'bg-[#e5005c]/60' : 'bg-[#3f3f46]'}`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function ProductCard({ product }: { product: ProductItem }) {
  const { isDark } = useTheme();
  const cardBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerBgClass = isDark ? 'bg-[#131316]' : 'bg-[#fafafa]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'SKU', value: product.sku || '—', mono: true },
    { label: 'UPC', value: product.upc || '—', mono: true },
    { label: 'Description', value: product.description || '—' },
    {
      label: 'Department',
      value: `${product.departmentCode || '?'} · ${product.departmentName}`,
    },
    {
      label: 'Sub Department',
      value: `${product.subDepartmentCode || '?'} · ${product.subDepartmentName}`,
    },
    { label: 'Cost', value: product.cost || '—', mono: true },
    { label: 'Price', value: product.price || '—', mono: true },
  ];

  return (
    <View className={`rounded-xl border p-4 ${cardBgClass}`}>
      <View className="mb-3 flex-row items-center gap-2">
        <Package color="#e5005c" size={18} />
        <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>Scanned Product</Text>
      </View>
      <View className={`rounded-lg p-3 ${innerBgClass}`}>
        {rows.map((row) => (
          <View key={row.label} className="flex-row items-start justify-between py-1.5">
            <Text
              className={`font-jetbrains text-[10px] uppercase tracking-wider ${textSecondaryClass}`}>
              {row.label}
            </Text>
            <Text
              className={`max-w-[62%] text-right text-xs font-semibold ${textPrimaryClass} ${
                row.mono ? 'font-jetbrains' : 'font-hanken'
              }`}
              numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReasonPickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}) {
  const { isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <View
          className={`max-h-[80%] w-full rounded-xl border p-5 ${
            isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className={`font-hanken text-base font-bold ${
                isDark ? 'text-[#fafafa]' : 'text-[#18181b]'
              }`}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const isSelected = selected === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    onSelect(option);
                    onClose();
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                  }}
                  className={`mb-2 flex-row items-center justify-between rounded-lg border p-3 ${
                    isSelected
                      ? 'border-[#e5005c] bg-[#e5005c]/15'
                      : isDark
                        ? 'border-[#3f3f46] bg-[#131316]'
                        : 'border-[#e4e4e7] bg-[#fafafa]'
                  }`}>
                  <Text
                    className={`flex-1 pr-2 font-hanken text-xs font-semibold ${
                      isSelected ? 'text-[#e5005c]' : isDark ? 'text-[#fafafa]' : 'text-[#18181b]'
                    }`}>
                    {option}
                  </Text>
                  {isSelected && <CheckCircle color="#e5005c" size={16} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatusBadge({ status }: { status: DLRStatus }) {
  const config =
    status === 'PENDING_SYNC'
      ? { label: 'QUEUED', color: '#f59e0b' }
      : status === 'SYNCED'
        ? { label: 'SYNCED', color: '#22c55e' }
        : { label: 'DRAFT', color: '#a1a1aa' };
  return (
    <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${config.color}22` }}>
      <Text className="font-jetbrains text-[8px] font-bold" style={{ color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}

function formatRecordTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function DamageLostRecordScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation();
  const { storeCode, storeName } = useAuth();
  const { isDark } = useTheme();

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';
  const inputBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#fafafa] border-[#e4e4e7]';

  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    if (!permission || (!permission.granted && permission.canAskAgain)) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const [step, setStep] = useState<Step>('SCAN');
  const [draft, setDraft] = useState<DLRLocalRecord | null>(null);
  const draftRef = useRef<DLRLocalRecord | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const [isLookingUp, setIsLookingUp] = useState(false);
  const isLookingUpRef = useRef(false);
  useEffect(() => {
    isLookingUpRef.current = isLookingUp;
  }, [isLookingUp]);

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const [photoIndex, setPhotoIndex] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const [pickerTarget, setPickerTarget] = useState<'reason' | 'secondReason' | null>(null);
  const [retakeKey, setRetakeKey] = useState<DLRPhotoKey | null>(null);

  const [recordsModalVisible, setRecordsModalVisible] = useState(false);
  const [allRecords, setAllRecords] = useState<DLRLocalRecord[]>([]);
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [catalogStatus, setCatalogStatus] = useState<string>('');

  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotification = useCallback(
    (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      setNotification({ type, title, message });
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
      }, 3500);
    },
    []
  );

  const refreshPendingCount = useCallback(async () => {
    const records = await loadDlrRecords();
    setDraftCount(records.length);
    const count = records.filter((r) => r.status === 'PENDING_SYNC').length;
    setPendingSyncCount(count);
    return count;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refreshPendingCount().then((count) => {
        if (!active || count === 0) return;
        processDlrSyncQueue()
          .then((outcome) => {
            if (!active) return;
            refreshPendingCount();
            if (outcome.syncedIds.length > 0) {
              showNotification(
                'success',
                'SYNC COMPLETE',
                `${outcome.syncedIds.length} offline record(s) uploaded successfully`
              );
            }
          })
          .catch(() => {});
      });
      fetchCatalog()
        .then((list) => {
          if (active) setCatalogStatus(`${list.length.toLocaleString()} SKUs loaded`);
        })
        .catch(() => {
          if (active) setCatalogStatus('Catalog offline — scan unavailable');
        });
      return () => {
        active = false;
      };
    }, [refreshPendingCount, showNotification])
  );

  const resetFlow = useCallback(() => {
    setDraft(null);
    setPhotoIndex(0);
    setPreviewUri(null);
    setRetakeKey(null);
    setTorchEnabled(false);
    setSubmitted(false);
    setOfflineError(null);
    setProgressText('');
    setSubmitting(false);
    setStep('SCAN');
  }, []);

  const handleLookup = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || isLookingUpRef.current) return;
      setIsLookingUp(true);
      try {
        const product = await lookupProduct(code);
        feedback('success');
        const now = new Date().toISOString();
        const record: DLRLocalRecord = {
          id: createDlrId(),
          status: 'DRAFT',
          createdAt: now,
          updatedAt: now,
          storeCode: storeCode || '',
          storeName: storeName || '',
          scannedCode: code,
          product,
          reason: null,
          secondReason: null,
          qty: 1,
          photos: {},
          uploadedUrls: {},
        };
        setDraft(record);
        await upsertDlrRecord(record);
        setStep('DETAILS');
        showNotification('success', 'ITEM MATCHED', product.description || product.sku || code);
      } catch (err) {
        feedback('error');
        showNotification(
          'error',
          'LOOKUP FAILED',
          err instanceof Error ? err.message : String(err)
        );
      } finally {
        setIsLookingUp(false);
      }
    },
    [showNotification, storeCode, storeName]
  );

  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (step !== 'SCAN' || isLookingUpRef.current) return;
      handleLookup(data);
    },
    [step, handleLookup]
  );

  const submitManual = () => {
    const value = manualInput.trim();
    if (!value) return;
    setManualModalVisible(false);
    setManualInput('');
    handleLookup(value);
  };

  const updateDraft = useCallback(async (updater: (record: DLRLocalRecord) => DLRLocalRecord) => {
    const current = draftRef.current;
    if (!current) return null;
    const updated = updater(current);
    draftRef.current = updated;
    setDraft(updated);
    await upsertDlrRecord(updated);
    return updated;
  }, []);

  const confirmDetails = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return;
    if (!current.reason) {
      showNotification('error', 'REASON REQUIRED', 'Select a defect reason before continuing');
      feedback('error');
      return;
    }
    if (!Number.isFinite(current.qty) || (current.qty ?? 0) < 1) {
      showNotification('error', 'QTY REQUIRED', 'Enter a damaged quantity of at least 1');
      feedback('error');
      return;
    }
    await updateDraft(() => ({ ...current }));
    feedback('success');
    setStep('PHOTOS');
  }, [showNotification, updateDraft]);

  const capturePhoto = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setPreviewUri(photo.uri);
      } else {
        throw new Error('Capture failed — no image returned');
      }
    } catch (err) {
      feedback('error');
      showNotification(
        'error',
        'CAPTURE FAILED',
        err instanceof Error ? err.message : 'Could not take picture'
      );
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, showNotification]);

  const confirmPhoto = useCallback(async () => {
    const current = draftRef.current;
    if (!previewUri || !current) return;
    const stepConfig = PHOTO_STEPS[photoIndex];
    await updateDraft((record) => ({
      ...record,
      photos: { ...record.photos, [stepConfig.key]: previewUri },
    }));
    setPreviewUri(null);
    feedback('success');
    if (photoIndex < PHOTO_STEPS.length - 1) {
      setPhotoIndex(photoIndex + 1);
    } else {
      setStep('SUBMIT');
    }
  }, [previewUri, photoIndex, updateDraft]);

  const cancelRetake = useCallback(() => {
    setPreviewUri(null);
    setRetakeKey(null);
  }, []);

  const confirmRetake = useCallback(async () => {
    const key = retakeKey;
    if (!previewUri || !key) return;
    await updateDraft((record) => {
      const uploadedUrls = { ...(record.uploadedUrls ?? {}) };
      delete uploadedUrls[key];
      return {
        ...record,
        photos: { ...record.photos, [key]: previewUri },
        uploadedUrls,
        status: record.status === 'DRAFT' ? 'DRAFT' : 'PENDING_SYNC',
        updatedAt: new Date().toISOString(),
      };
    });
    setPreviewUri(null);
    setRetakeKey(null);
    feedback('success');
  }, [previewUri, retakeKey, updateDraft]);

  const handleSubmit = useCallback(async () => {
    const record = draftRef.current;
    if (!record || submitting) return;
    if (!record.product || !record.reason) {
      showNotification('error', 'INCOMPLETE RECORD', 'Product and defect reason are required');
      return;
    }

    setSubmitting(true);
    setOfflineError(null);

    try {
      const urls: Partial<Record<DLRPhotoKey, string>> = { ...(record.uploadedUrls ?? {}) };

      for (let i = 0; i < PHOTO_STEPS.length; i++) {
        const stepConfig = PHOTO_STEPS[i];
        if (urls[stepConfig.key]) continue;
        const localUri = record.photos[stepConfig.key];
        if (!localUri) {
          throw new Error(`${stepConfig.title} is missing`);
        }
        setProgressText(`Optimizing ${stepConfig.title} (${i + 1}/${PHOTO_STEPS.length})…`);
        const compressedUri = await compressImage(localUri);
        setProgressText(`Uploading ${stepConfig.title} (${i + 1}/${PHOTO_STEPS.length})…`);
        urls[stepConfig.key] = await uploadToCloudinary(
          compressedUri,
          buildDlrImageName(record, stepConfig.key)
        );

        const latest = draftRef.current;
        if (latest) {
          const updated: DLRLocalRecord = {
            ...latest,
            uploadedUrls: { ...urls },
            status: 'PENDING_SYNC',
            updatedAt: new Date().toISOString(),
          };
          draftRef.current = updated;
          setDraft(updated);
          await upsertDlrRecord(updated);
        }
      }

      setProgressText('Saving record to database…');
      const finalRecord = draftRef.current ?? record;
      const payload = buildSupabasePayload({ ...finalRecord, uploadedUrls: urls });
      if (!payload) throw new Error('Record is incomplete');

      const { error } = await supabase.from('dlr_records').insert([payload]);
      if (error) throw new Error(error.message);

      const records = await loadDlrRecords();
      await saveDlrRecords(records.filter((r) => r.id !== record.id));
      await refreshPendingCount();
      feedback('success');
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed: DLRLocalRecord = {
        ...(draftRef.current ?? record),
        status: 'PENDING_SYNC',
        lastError: message,
        updatedAt: new Date().toISOString(),
      };
      draftRef.current = failed;
      setDraft(failed);
      await upsertDlrRecord(failed);
      await refreshPendingCount();
      feedback('error');
      setOfflineError(message);
      showNotification('warning', 'SAVED OFFLINE', 'Record queued — will sync automatically');
    } finally {
      setSubmitting(false);
      setProgressText('');
    }
  }, [refreshPendingCount, showNotification, submitting]);

  const manualSync = useCallback(async () => {
    const count = await getPendingSyncCount();
    if (count === 0) {
      showNotification('info', 'NOTHING TO SYNC', 'No offline DLR records queued');
      return;
    }
    showNotification('info', 'SYNCING', `Uploading ${count} queued record(s)…`);
    try {
      const outcome = await processDlrSyncQueue();
      await refreshPendingCount();
      if (outcome.syncedIds.length > 0) {
        feedback('success');
        showNotification(
          'success',
          'SYNC COMPLETE',
          `${outcome.syncedIds.length} record(s) uploaded`
        );
      } else {
        feedback('warning');
        showNotification(
          'warning',
          'STILL OFFLINE',
          `${outcome.failedCount} record(s) could not be uploaded yet`
        );
      }
    } catch {
      feedback('error');
    }
  }, [refreshPendingCount, showNotification]);

  const loadAllRecords = useCallback(async () => {
    setIsRefreshingRecords(true);
    try {
      setAllRecords(await loadDlrRecords());
    } finally {
      setIsRefreshingRecords(false);
    }
  }, []);

  const openRecordsModal = useCallback(() => {
    setRecordsModalVisible(true);
    loadAllRecords();
  }, [loadAllRecords]);

  const syncAndReload = useCallback(async () => {
    await manualSync();
    await loadAllRecords();
  }, [manualSync, loadAllRecords]);

  const handleDeleteRecord = useCallback(
    (record: DLRLocalRecord) => {
      const label = record.product?.sku || record.scannedCode || 'this item';
      Alert.alert('Delete Record', `Delete the saved record for ${label}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const records = await loadDlrRecords();
            const updated = records.filter((r) => r.id !== record.id);
            await saveDlrRecords(updated);
            if (draftRef.current?.id === record.id) {
              resetFlow();
            }
            setAllRecords(updated);
            await refreshPendingCount();
            feedback('warning');
          },
        },
      ]);
    },
    [refreshPendingCount, resetFlow]
  );

  const handleClearAll = useCallback(() => {
    const removable = allRecords.filter((r) => r.id !== draftRef.current?.id);
    if (removable.length === 0) {
      showNotification('info', 'NOTHING TO CLEAR', 'The current in-progress draft is preserved');
      return;
    }
    Alert.alert(
      'Clear All Records',
      `Delete ${removable.length} saved record(s)? Queued offline records will also be removed. The current in-progress draft is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CLEAR ALL',
          style: 'destructive',
          onPress: async () => {
            const keepId = draftRef.current?.id;
            const records = await loadDlrRecords();
            const updated = keepId ? records.filter((r) => r.id === keepId) : [];
            await saveDlrRecords(updated);
            setAllRecords(updated);
            await refreshPendingCount();
            feedback('warning');
            showNotification('success', 'CLEARED', `${removable.length} record(s) deleted`);
          },
        },
      ]
    );
  }, [allRecords, refreshPendingCount, showNotification]);

  const handleResumeRecord = useCallback((record: DLRLocalRecord) => {
    const firstMissing = PHOTO_STEPS.findIndex((s) => !record.photos[s.key]);
    const hasAllPhotos = firstMissing < 0;
    draftRef.current = record;
    setDraft(record);
    setPhotoIndex(hasAllPhotos ? PHOTO_STEPS.length - 1 : firstMissing);
    setPreviewUri(null);
    setRetakeKey(null);
    setTorchEnabled(false);
    setSubmitted(false);
    setOfflineError(null);
    setProgressText('');
    setSubmitting(false);
    setStep(!record.reason ? 'DETAILS' : hasAllPhotos ? 'SUBMIT' : 'PHOTOS');
    setRecordsModalVisible(false);
    feedback('success');
  }, []);

  const cameraRef = useRef<CameraView | null>(null);

  const notificationColors: Record<string, string> = {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  };

  const currentPhotoStep = PHOTO_STEPS[Math.min(photoIndex, PHOTO_STEPS.length - 1)];
  const capturedCount = draft ? PHOTO_STEPS.filter((s) => draft.photos[s.key]).length : 0;

  const renderScanStep = () => {
    if (!permission || !permission.granted) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Camera color="#e5005c" size={48} />
          <Text className={`mt-4 text-center font-hanken text-base font-bold ${textPrimaryClass}`}>
            Camera Access Required
          </Text>
          <Text className={`mb-5 mt-1 text-center font-hanken text-xs ${textSecondaryClass}`}>
            Grant camera permission to scan item barcodes and capture damage photos.
          </Text>
          {permission?.canAskAgain === false ? (
            <Text className={`text-center font-jetbrains text-xs ${textSecondaryClass}`}>
              Permission permanently denied — enable it from system settings.
            </Text>
          ) : (
            <TouchableOpacity
              onPress={() => requestPermission()}
              className="rounded-lg bg-[#e5005c] px-6 py-3">
              <Text className="font-jetbrains text-xs font-bold text-white">GRANT ACCESS</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View className="mx-3 mb-3 flex-1 overflow-hidden rounded-xl border border-[#3f3f46]">
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'code39',
              'code93',
              'code128',
              'codabar',
              'itf14',
              'qr',
            ],
          }}
        />
        <View pointerEvents="none" className="flex-1 items-center justify-center">
          <View className="h-52 w-[78%] rounded-2xl border-2 border-[#e5005c]/80 opacity-90" />
          <View className="mt-4 rounded-lg bg-black/60 px-4 py-2">
            <Text className="font-jetbrains text-xs font-bold text-white">
              {isLookingUp ? 'MATCHING ITEM…' : 'ALIGN BARCODE WITHIN FRAME'}
            </Text>
          </View>
          {catalogStatus ? (
            <View className="mt-2 rounded-lg bg-black/50 px-3 py-1">
              <Text className="font-jetbrains text-[10px] text-[#a1a1aa]">{catalogStatus}</Text>
            </View>
          ) : null}
        </View>

        <View className="absolute bottom-0 left-0 right-0 items-center pb-5">
          {isLookingUp ? (
            <View className="mb-3 flex-row items-center gap-2 rounded-full bg-black/70 px-4 py-2">
              <ActivityIndicator size="small" color="#e5005c" />
              <Text className="font-jetbrains text-xs font-bold text-white">Fetching catalog…</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => setManualModalVisible(true)}
            className="flex-row items-center gap-2 rounded-full border border-white/30 bg-black/60 px-5 py-2.5">
            <Search color="#ffffff" size={14} />
            <Text className="font-jetbrains text-xs font-bold text-white">ENTER CODE MANUALLY</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDetailsStep = () => {
    const product = draft?.product;
    if (!product) return null;

    return (
      <ScrollView className="flex-1 px-3 pt-3" showsVerticalScrollIndicator={false}>
        <ProductCard product={product} />

        <View className={`mt-4 rounded-xl border p-4 ${cardBgClass}`}>
          <Text className={`mb-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
            Defect Classification
          </Text>

          <Text
            className={`mb-1.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
            REASON (REQUIRED)
          </Text>
          <TouchableOpacity
            onPress={() => setPickerTarget('reason')}
            className={`mb-3 h-11 flex-row items-center justify-between rounded-lg border px-3 ${
              draft?.reason ? 'border-[#e5005c]/60' : ''
            } ${inputBgClass}`}>
            <Text
              className={`font-hanken text-xs font-semibold ${
                draft?.reason ? 'text-[#e5005c]' : textSecondaryClass
              }`}>
              {draft?.reason || 'Select defect reason…'}
            </Text>
            <ChevronDown color="#a1a1aa" size={16} />
          </TouchableOpacity>

          <Text
            className={`mb-1.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
            SECOND REASON (OPTIONAL)
          </Text>
          <TouchableOpacity
            onPress={() => setPickerTarget('secondReason')}
            className={`h-11 flex-row items-center justify-between rounded-lg border px-3 ${inputBgClass}`}>
            <Text
              className={`font-hanken text-xs font-semibold ${
                draft?.secondReason ? textPrimaryClass : textSecondaryClass
              }`}>
              {draft?.secondReason || 'Select secondary reason…'}
            </Text>
            <ChevronDown color="#a1a1aa" size={16} />
          </TouchableOpacity>

          {draft?.secondReason ? (
            <TouchableOpacity
              onPress={async () => {
                await updateDraft((record) => ({ ...record, secondReason: null }));
              }}
              className="mt-2 flex-row items-center gap-1 self-start">
              <X color="#ef4444" size={12} />
              <Text className="font-jetbrains text-[10px] font-bold text-[#ef4444]">
                CLEAR SECOND REASON
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text
            className={`mb-1.5 mt-4 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
            QTY DAMAGED (REQUIRED)
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() =>
                updateDraft((record) => ({
                  ...record,
                  qty: Math.max(0, (record.qty ?? 0) - 1),
                }))
              }
              className="h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]">
              <Minus color="#fafafa" size={18} />
            </TouchableOpacity>
            <TextInput
              value={draft?.qty !== undefined ? String(draft.qty) : ''}
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
                updateDraft((record) => ({
                  ...record,
                  qty: digits === '' ? 0 : parseInt(digits, 10),
                }));
              }}
              keyboardType="number-pad"
              className={`h-11 flex-1 rounded-lg border text-center font-jetbrains text-base font-bold ${textPrimaryClass} ${inputBgClass}`}
            />
            <TouchableOpacity
              onPress={() =>
                updateDraft((record) => ({
                  ...record,
                  qty: Math.min(999999, (record.qty ?? 0) + 1),
                }))
              }
              className="h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]">
              <Plus color="#fafafa" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row items-center gap-3 px-0 py-4">
          <TouchableOpacity
            onPress={() => setStep('SCAN')}
            className={`flex-1 items-center justify-center rounded-lg border py-3 ${inputBgClass}`}>
            <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
              RESCAN ITEM
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDetails}
            className="flex-1 items-center justify-center rounded-lg bg-[#e5005c] py-3">
            <Text className="font-jetbrains text-xs font-bold text-white">CONTINUE TO PHOTOS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderPhotosStep = () => (
    <View className="flex-1 px-3 pt-3">
      <View
        className={`mb-3 flex-row items-center justify-between rounded-xl border px-4 py-3 ${cardBgClass}`}>
        <View>
          <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
            Photo {photoIndex + 1}/{PHOTO_STEPS.length}: {currentPhotoStep.title}
          </Text>
          <Text className={`mt-0.5 font-hanken text-[11px] ${textSecondaryClass}`}>
            {currentPhotoStep.hint}
          </Text>
        </View>
        <View className="flex-row gap-1.5">
          {PHOTO_STEPS.map((s, idx) => {
            const done = Boolean(draft?.photos[s.key]);
            return (
              <View
                key={s.key}
                className={`h-2.5 w-2.5 rounded-full ${
                  done ? 'bg-[#22c55e]' : idx === photoIndex ? 'bg-[#e5005c]' : 'bg-[#3f3f46]'
                }`}
              />
            );
          })}
        </View>
      </View>

      {previewUri ? (
        <View className="flex-1 overflow-hidden rounded-xl border border-[#3f3f46]">
          <Image source={{ uri: previewUri }} style={{ flex: 1 }} resizeMode="contain" />
          <View className="flex-row gap-2 p-3">
            <TouchableOpacity
              onPress={() => setPreviewUri(null)}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#2a2a2d] py-3">
              <RotateCcw color="#a1a1aa" size={16} />
              <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">RETAKE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmPhoto}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-[#22c55e] py-3">
              <CheckCircle color="#ffffff" size={16} />
              <Text className="font-jetbrains text-xs font-bold text-white">
                {photoIndex === PHOTO_STEPS.length - 1 ? 'USE & CONTINUE' : 'USE PHOTO'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="flex-1 overflow-hidden rounded-xl border border-[#3f3f46]">
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            mode="picture"
            enableTorch={torchEnabled}
          />
          <View pointerEvents="box-none" className="flex-1 justify-between">
            <View className="items-center pt-4" pointerEvents="none">
              <View className="rounded-lg bg-black/60 px-3 py-1.5">
                <Text className="font-jetbrains text-[11px] font-bold text-white">
                  {capturedCount}/3 CAPTURED · {currentPhotoStep.hint.toUpperCase()}
                </Text>
              </View>
            </View>
            <View className="items-center pb-5">
              <View className="mb-4 flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => setTorchEnabled(!torchEnabled)}
                  className={`h-11 w-11 items-center justify-center rounded-full border ${
                    torchEnabled
                      ? 'border-[#f59e0b] bg-[#f59e0b]/25'
                      : 'border-white/30 bg-black/50'
                  }`}>
                  <Flashlight color={torchEnabled ? '#f59e0b' : '#ffffff'} size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={capturePhoto}
                  disabled={isCapturing}
                  className="h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-[#e5005c] disabled:opacity-50">
                  {isCapturing ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Camera color="#ffffff" size={24} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStep('DETAILS')}
                  className="h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50">
                  <ArrowLeft color="#ffffff" size={18} />
                </TouchableOpacity>
              </View>
              <Text className="font-jetbrains text-[10px] text-white/70">
                Tap shutter to capture · preview before continuing
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderSubmitStep = () => {
    if (submitted) {
      return (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          className="flex-1 px-5 py-6"
          showsVerticalScrollIndicator={false}>
          <View className="h-18 w-18 items-center justify-center rounded-full border border-[#22c55e]/30 bg-[#22c55e]/15">
            <CircleCheck color="#22c55e" size={40} />
          </View>
          <Text
            className={`mt-4 text-center font-hanken text-2xl font-extrabold ${textPrimaryClass}`}>
            Record Submitted
          </Text>
          <Text
            className={`mt-1.5 text-center font-hanken text-xs ${textSecondaryClass} max-w-[320px]`}>
            Damage record for{' '}
            <Text className="font-jetbrains font-bold text-[#e5005c]">
              {draft?.product?.sku || draft?.scannedCode}
            </Text>{' '}
            was successfully synced with all 3 evidence photos.
          </Text>

          {/* Central DLR Web Portal Card */}
          <View
            className={`mt-5 w-full rounded-xl border p-4 shadow-sm ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#e5005c]/15">
                <Globe color="#e5005c" size={20} />
              </View>
              <View className="flex-1">
                <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                  Central DLR Web Portal
                </Text>
                <Text
                  className={`font-jetbrains text-[10px] font-semibold text-[#e5005c]`}
                  numberOfLines={1}>
                  https://dlr-view.vercel.app/
                </Text>
              </View>
            </View>

            <Text className={`mt-2 font-hanken text-[11px] ${textSecondaryClass}`}>
              View and audit all submitted Damage & Lost Records with full image attachments online.
            </Text>

            <TouchableOpacity
              onPress={() => Linking.openURL('https://dlr-view.vercel.app/')}
              activeOpacity={0.8}
              className="mt-3.5 flex-row items-center justify-center gap-2 rounded-lg bg-[#e5005c] py-3 active:bg-[#c20050]">
              <Globe color="#ffffff" size={15} />
              <Text className="font-jetbrains text-xs font-bold tracking-wider text-white">
                VIEW IN DLR PORTAL
              </Text>
              <ExternalLink color="#ffffff" size={14} />
            </TouchableOpacity>
          </View>

          {/* Record Another Item Action */}
          <TouchableOpacity
            onPress={resetFlow}
            activeOpacity={0.8}
            className={`mt-3.5 w-full flex-row items-center justify-center gap-2 rounded-lg border py-3.5 ${
              isDark
                ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
            }`}>
            <Scan color={isDark ? '#fafafa' : '#18181b'} size={16} />
            <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
              RECORD ANOTHER ITEM
            </Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (retakeKey) {
      const retakeStep = PHOTO_STEPS.find((s) => s.key === retakeKey) ?? PHOTO_STEPS[0];
      return (
        <View className="flex-1 px-3 pt-3">
          <View
            className={`mb-3 flex-row items-center justify-between rounded-xl border px-4 py-3 ${cardBgClass}`}>
            <View className="flex-1">
              <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                {previewUri ? 'Review' : 'Capture'}: {retakeStep.title}
              </Text>
              <Text className={`mt-0.5 font-hanken text-[11px] ${textSecondaryClass}`}>
                {retakeStep.hint}
              </Text>
            </View>
            {!previewUri ? (
              <TouchableOpacity
                onPress={cancelRetake}
                className={`h-8 w-8 items-center justify-center rounded-full border ${inputBgClass}`}>
                <X color="#a1a1aa" size={14} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="flex-1 overflow-hidden rounded-xl border border-[#3f3f46]">
            {previewUri ? (
              <>
                <Image source={{ uri: previewUri }} style={{ flex: 1 }} resizeMode="contain" />
                <View className="flex-row gap-2 p-3">
                  <TouchableOpacity
                    onPress={() => setPreviewUri(null)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#2a2a2d] py-3">
                    <RotateCcw color="#a1a1aa" size={16} />
                    <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">RETAKE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmRetake}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-[#22c55e] py-3">
                    <CheckCircle color="#ffffff" size={16} />
                    <Text className="font-jetbrains text-xs font-bold text-white">USE PHOTO</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  mode="picture"
                  enableTorch={torchEnabled}
                />
                <View pointerEvents="box-none" className="flex-1 justify-end">
                  <View className="items-center pb-5">
                    <View className="mb-4 flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => setTorchEnabled(!torchEnabled)}
                        className={`h-11 w-11 items-center justify-center rounded-full border ${
                          torchEnabled
                            ? 'border-[#f59e0b] bg-[#f59e0b]/25'
                            : 'border-white/30 bg-black/50'
                        }`}>
                        <Flashlight color={torchEnabled ? '#f59e0b' : '#ffffff'} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={capturePhoto}
                        disabled={isCapturing}
                        className="h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-[#e5005c] disabled:opacity-50">
                        {isCapturing ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Camera color="#ffffff" size={24} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={cancelRetake}
                        className="h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50">
                        <X color="#ffffff" size={18} />
                      </TouchableOpacity>
                    </View>
                    <Text className="font-jetbrains text-[10px] text-white/70">
                      Tap shutter · {retakeStep.title.toLowerCase()}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      );
    }

    return (
      <ScrollView className="flex-1 px-3 pt-3" showsVerticalScrollIndicator={false}>
        {offlineError ? (
          <View className="mb-3 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-4">
            <View className="mb-1 flex-row items-center gap-2">
              <WifiOff color="#f59e0b" size={16} />
              <Text className="font-jetbrains text-xs font-bold text-[#f59e0b]">
                SAVED AS PENDING SYNC
              </Text>
            </View>
            <Text className="font-hanken text-[11px] text-[#f59e0b]">{offlineError}</Text>
            <Text className={`mt-1 font-hanken text-[11px] ${textSecondaryClass}`}>
              The full payload and local images are stored on-device and will retry automatically.
            </Text>
          </View>
        ) : null}

        {draft?.product ? <ProductCard product={draft.product} /> : null}

        <View className={`mt-4 rounded-xl border p-4 ${cardBgClass}`}>
          <Text className={`mb-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
            Evidence Photos ({capturedCount}/3)
          </Text>
          <Text className={`mb-2 font-hanken text-[10px] ${textSecondaryClass}`}>
            Tap any photo to capture or retake it
          </Text>
          <View className="flex-row gap-2">
            {PHOTO_STEPS.map((s) => {
              const uri = draft?.photos[s.key];
              const uploadedUrl = draft?.uploadedUrls?.[s.key];
              return (
                <TouchableOpacity
                  key={s.key}
                  activeOpacity={0.75}
                  disabled={submitting}
                  onPress={() => {
                    setPreviewUri(null);
                    setRetakeKey(s.key);
                  }}
                  className="flex-1">
                  <View
                    className={`aspect-square items-center justify-center overflow-hidden rounded-lg border ${
                      uri ? 'border-[#22c55e]/50' : 'border-dashed border-[#e5005c]/50'
                    } ${isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'}`}>
                    {uri ? (
                      <Image
                        source={{ uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Camera color="#71717a" size={20} />
                    )}
                    {uploadedUrl ? (
                      <View className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5">
                        <CheckCircle color="#22c55e" size={12} />
                      </View>
                    ) : (
                      <View className="absolute left-1 top-1 rounded-full bg-black/70 p-1">
                        <RotateCcw color="#ffffff" size={10} />
                      </View>
                    )}
                  </View>
                  <Text
                    className={`mt-1 text-center font-jetbrains text-[8px] uppercase ${textSecondaryClass}`}
                    numberOfLines={1}>
                    {s.title.replace(' Photo', '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            className={`mt-3 flex-row items-center justify-between rounded-lg px-3 py-2 ${isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'}`}>
            <Text className={`font-jetbrains text-[10px] uppercase ${textSecondaryClass}`}>
              Store
            </Text>
            <Text
              className={`max-w-[65%] text-right font-jetbrains text-xs font-bold ${textPrimaryClass}`}
              numberOfLines={1}>
              {draft?.storeCode || storeCode || 'N/A'}
              {storeName ? ` · ${storeName}` : ''}
            </Text>
          </View>
          <View
            className={`mt-1.5 flex-row items-center justify-between rounded-lg px-3 py-2 ${isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'}`}>
            <Text className={`font-jetbrains text-[10px] uppercase ${textSecondaryClass}`}>
              Qty
            </Text>
            <Text
              className="max-w-[65%] text-right font-jetbrains text-xs font-bold text-[#e5005c]"
              numberOfLines={1}>
              {draft?.qty ?? 1}
            </Text>
          </View>
          <View
            className={`mt-1.5 flex-row items-center justify-between rounded-lg px-3 py-2 ${isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'}`}>
            <Text className={`font-jetbrains text-[10px] uppercase ${textSecondaryClass}`}>
              Reason
            </Text>
            <Text
              className="max-w-[65%] text-right font-hanken text-xs font-bold text-[#e5005c]"
              numberOfLines={2}>
              {draft?.reason || '—'}
            </Text>
          </View>
          {draft?.secondReason ? (
            <View
              className={`mt-1.5 flex-row items-center justify-between rounded-lg px-3 py-2 ${isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'}`}>
              <Text className={`font-jetbrains text-[10px] uppercase ${textSecondaryClass}`}>
                Second Reason
              </Text>
              <Text
                className={`max-w-[65%] text-right font-hanken text-xs font-bold ${textPrimaryClass}`}
                numberOfLines={2}>
                {draft.secondReason}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Central DLR Web Portal Reference Link */}
        <TouchableOpacity
          onPress={() => Linking.openURL('https://dlr-view.vercel.app/')}
          activeOpacity={0.8}
          className={`mt-3 flex-row items-center justify-between rounded-xl border p-3 ${
            isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          <View className="flex-row items-center gap-2.5">
            <View className="rounded-lg bg-[#e5005c]/10 p-2">
              <Globe color="#e5005c" size={16} />
            </View>
            <View>
              <Text className={`font-hanken text-xs font-bold ${textPrimaryClass}`}>
                Live DLR Portal
              </Text>
              <Text className="font-jetbrains text-[10px] text-[#e5005c]">
                https://dlr-view.vercel.app/
              </Text>
            </View>
          </View>
          <ExternalLink color={isDark ? '#a1a1aa' : '#71717a'} size={15} />
        </TouchableOpacity>

        {submitting ? (
          <View className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-[#e5005c]/30 bg-[#e5005c]/10 py-3.5">
            <ActivityIndicator size="small" color="#e5005c" />
            <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
              {progressText || 'Processing…'}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-3 py-4">
            <TouchableOpacity
              onPress={() => setStep('PHOTOS')}
              className={`flex-1 items-center justify-center rounded-lg border py-3 ${inputBgClass}`}
              disabled={submitting}>
              <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>BACK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={capturedCount < 3}
              className="flex-[2] flex-row items-center justify-center gap-2 rounded-lg bg-[#e5005c] py-3 disabled:opacity-40">
              <CloudUpload color="#ffffff" size={16} />
              <Text className="font-jetbrains text-xs font-bold text-white">SUBMIT RECORD</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${bgClass}`}>
      <View className={`flex-row items-center gap-3 border-b px-4 py-3 ${headerBgClass}`}>
        {!embedded ? (
          <TouchableOpacity
            onPress={() => {
              if (submitted) {
                resetFlow();
              } else {
                navigation.goBack();
              }
            }}>
            <ArrowLeft color={isDark ? '#fafafa' : '#18181b'} size={22} />
          </TouchableOpacity>
        ) : null}
        <View className="flex-1">
          <Text className={`font-hanken text-lg font-bold ${textPrimaryClass}`}>
            Damage Lost Record
          </Text>
          <Text className={`font-jetbrains text-[9px] font-semibold ${textSecondaryClass}`}>
            4 STEPS TO COMPLETE
          </Text>
        </View>
        <TouchableOpacity
          onPress={openRecordsModal}
          className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
            draftCount > 0
              ? 'border-[#e5005c]/50 bg-[#e5005c]/10'
              : 'border-[#3f3f46] bg-transparent'
          }`}>
          <ClipboardList color={draftCount > 0 ? '#e5005c' : '#a1a1aa'} size={13} />
          {draftCount > 0 ? (
            <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
              {draftCount}
            </Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={manualSync}
          className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
            pendingSyncCount > 0
              ? 'border-[#f59e0b]/50 bg-[#f59e0b]/10'
              : 'border-[#3f3f46] bg-transparent'
          }`}>
          <RefreshCw color={pendingSyncCount > 0 ? '#f59e0b' : '#a1a1aa'} size={13} />
          <Text
            className={`font-jetbrains text-[10px] font-bold ${
              pendingSyncCount > 0 ? 'text-[#f59e0b]' : '#a1a1aa'
            }`}>
            {pendingSyncCount > 0 ? `${pendingSyncCount} QUEUED` : 'SYNCED'}
          </Text>
        </TouchableOpacity>
      </View>

      {!submitted ? (
        <StepIndicator
          current={step}
          textPrimaryClass={textPrimaryClass}
          textSecondaryClass={textSecondaryClass}
        />
      ) : null}

      {step === 'SCAN' && renderScanStep()}
      {step === 'DETAILS' && renderDetailsStep()}
      {step === 'PHOTOS' && renderPhotosStep()}
      {step === 'SUBMIT' && renderSubmitStep()}

      {notification ? (
        <View pointerEvents="none" className="absolute left-4 right-4 top-24 z-50">
          <View
            className="flex-row items-center gap-2 rounded-xl border p-3.5"
            style={{
              backgroundColor: isDark ? '#1f1f22' : '#ffffff',
              borderColor: `${notificationColors[notification.type]}66`,
            }}>
            {notification.type === 'success' ? (
              <CheckCircle color={notificationColors.success} size={18} />
            ) : (
              <AlertTriangle color={notificationColors[notification.type]} size={18} />
            )}
            <View className="flex-1">
              <Text
                className="font-jetbrains text-[11px] font-bold"
                style={{ color: notificationColors[notification.type] }}>
                {notification.title}
              </Text>
              <Text className={`font-hanken text-[11px] ${textSecondaryClass}`} numberOfLines={2}>
                {notification.message}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className={`w-full rounded-xl border p-5 ${cardBgClass}`}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                Manual Code Entry
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setManualModalVisible(false);
                  setManualInput('');
                }}>
                <X color="#a1a1aa" size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Enter SKU or UPC…"
              placeholderTextColor="#71717a"
              autoFocus
              autoCapitalize="characters"
              keyboardType="default"
              className={`mb-4 h-11 rounded-lg border px-3 font-jetbrains text-sm ${textPrimaryClass} ${inputBgClass}`}
            />
            <TouchableOpacity
              onPress={submitManual}
              className="items-center justify-center rounded-lg bg-[#e5005c] py-3">
              <Text className="font-jetbrains text-sm font-bold text-white">LOOK UP ITEM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ReasonPickerModal
        visible={pickerTarget === 'reason'}
        title="Select Defect Reason"
        options={DEFECT_REASONS}
        selected={draft?.reason ?? null}
        onSelect={(value) => {
          updateDraft((record) => ({ ...record, reason: value }));
        }}
        onClose={() => setPickerTarget(null)}
      />

      <ReasonPickerModal
        visible={pickerTarget === 'secondReason'}
        title="Select Second Reason (Optional)"
        options={['(None)', ...DEFECT_REASONS]}
        selected={draft?.secondReason ?? '(None)'}
        onSelect={(value) => {
          const resolved = value === '(None)' ? null : value;
          updateDraft((record) => ({ ...record, secondReason: resolved }));
        }}
        onClose={() => setPickerTarget(null)}
      />

      <Modal visible={recordsModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/70">
          <View className={`max-h-[85%] rounded-t-2xl border-t px-4 pb-8 pt-4 ${cardBgClass}`}>
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ClipboardList color="#e5005c" size={18} />
                <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                  Saved Records
                </Text>
                <View className="rounded-full bg-[#e5005c]/15 px-2 py-0.5">
                  <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                    {allRecords.length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setRecordsModalVisible(false)}>
                <X color="#a1a1aa" size={20} />
              </TouchableOpacity>
            </View>

            {allRecords.length > 0 ? (
              <View className="mb-3 flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={syncAndReload}
                  disabled={pendingSyncCount === 0 || submitting}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 py-2.5 disabled:opacity-40">
                  <RefreshCw color="#22c55e" size={13} />
                  <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                    SYNC ALL ({pendingSyncCount})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleClearAll}
                  disabled={submitting}
                  className="flex-row items-center justify-center gap-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5">
                  <Trash2 color="#ef4444" size={13} />
                  <Text className="font-jetbrains text-[10px] font-bold text-[#ef4444]">
                    CLEAR ALL
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {allRecords.length === 0 && !isRefreshingRecords ? (
              <View className="items-center py-14">
                <ClipboardList color="#52525b" size={36} />
                <Text className={`mt-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
                  No saved records
                </Text>
                <Text className={`mt-1 text-center font-hanken text-xs ${textSecondaryClass}`}>
                  Scanned drafts and offline queue items will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                {allRecords.map((record) => {
                  const captured = PHOTO_STEPS.filter((s) => record.photos[s.key]).length;
                  return (
                    <View
                      key={record.id}
                      className={`mb-2.5 rounded-xl border p-3 ${inputBgClass}`}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 flex-row items-center gap-2">
                          <StatusBadge status={record.status} />
                          <Text
                            className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}
                            numberOfLines={1}>
                            {record.product?.sku || record.scannedCode || 'UNKNOWN'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteRecord(record)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 color="#ef4444" size={15} />
                        </TouchableOpacity>
                      </View>

                      {record.product?.description ? (
                        <Text
                          className={`mt-1 font-hanken text-[11px] ${textSecondaryClass}`}
                          numberOfLines={1}>
                          {record.product.description}
                        </Text>
                      ) : null}
                      <Text
                        className={`mt-0.5 font-hanken text-[10px] ${textSecondaryClass}`}
                        numberOfLines={1}>
                        {record.reason || 'No reason selected'} ·{' '}
                        {record.qty ? `Qty ${record.qty} · ` : ''}
                        {formatRecordTime(record.createdAt)}
                      </Text>
                      {record.lastError ? (
                        <Text
                          className="mt-0.5 font-jetbrains text-[9px] text-[#ef4444]"
                          numberOfLines={2}>
                          ⚠ {record.lastError}
                        </Text>
                      ) : null}

                      <View className="mt-2 flex-row items-center gap-1.5">
                        {PHOTO_STEPS.map((s) => {
                          const uri = record.photos[s.key];
                          return (
                            <View
                              key={s.key}
                              className={`h-11 w-11 items-center justify-center overflow-hidden rounded-md border ${
                                uri ? 'border-[#22c55e]/50' : 'border-dashed border-[#3f3f46]'
                              } ${isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'}`}>
                              {uri ? (
                                <Image
                                  source={{ uri }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Camera color="#52525b" size={12} />
                              )}
                            </View>
                          );
                        })}
                        <View className="ml-auto items-end">
                          <Text className={`font-jetbrains text-[9px] ${textSecondaryClass}`}>
                            {captured}/3 photos
                          </Text>
                          {record.storeName || record.storeCode ? (
                            <Text
                              className={`max-w-[140px] text-right font-jetbrains text-[9px] ${textSecondaryClass}`}
                              numberOfLines={1}>
                              {record.storeName || `Store ${record.storeCode}`}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleResumeRecord(record)}
                        className="mt-2.5 items-center justify-center rounded-lg border border-[#e5005c]/40 bg-[#e5005c]/10 py-2">
                        <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                          RESUME RECORD
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
