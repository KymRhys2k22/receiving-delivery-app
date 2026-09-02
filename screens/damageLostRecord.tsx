import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
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
  Wifi,
  RotateCcw,
  Search,
  CircleCheck,
  ClipboardList,
  Trash2,
  Plus,
  Minus,
  ExternalLink,
  Globe,
  Database,
  Building2,
} from 'lucide-react-native';
import { NavigationContext } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
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
  fetchSupabaseDlrRecords,
  deleteSupabaseDlrRecord,
  lookupProduct,
  supabase,
  uploadToCloudinary,
  type DLRLocalRecord,
  type DLRPhotoKey,
  type ProductItem,
  type SupabaseDLRRow,
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

function LoadingBar({
  progress,
  color = '#e5005c',
  height = 4,
  className = '',
}: {
  progress?: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (progress === undefined) {
      animValue.setValue(0);
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 850,
            useNativeDriver: false,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 850,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      Animated.timing(animValue, {
        toValue: Math.max(0, Math.min(1, progress)),
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, animValue]);

  const widthStyle =
    progress === undefined
      ? animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['25%', '85%'],
        })
      : animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%'],
        });

  const leftStyle =
    progress === undefined
      ? animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '15%'],
        })
      : 0;

  return (
    <View
      className={`w-full overflow-hidden rounded-full bg-[#3f3f46]/30 ${className}`}
      style={{ height }}>
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
          width: widthStyle,
          left: leftStyle,
        }}
      />
    </View>
  );
}

export default function DamageLostRecordScreen({
  embedded = false,
  navigation: propNavigation,
}: {
  embedded?: boolean;
  navigation?: any;
}) {
  const contextNavigation = useContext(NavigationContext);
  const navigation = propNavigation || contextNavigation;
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

  const [isScanActive, setIsScanActive] = useState(false);
  const isScanActiveRef = useRef(false);
  useEffect(() => {
    isScanActiveRef.current = isScanActive;
  }, [isScanActive]);
  const scanCooldown = useRef(false);

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const [photoIndex, setPhotoIndex] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  const [pickerTarget, setPickerTarget] = useState<'reason' | 'secondReason' | null>(null);
  const [retakeKey, setRetakeKey] = useState<DLRPhotoKey | null>(null);

  const [recordsModalVisible, setRecordsModalVisible] = useState(false);
  const [supabaseRecords, setSupabaseRecords] = useState<SupabaseDLRRow[]>([]);
  const [isLoadingSupabase, setIsLoadingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [recordsSearchQuery, setRecordsSearchQuery] = useState('');
  const [recordsPage, setRecordsPage] = useState(1);
  const RECORDS_PER_PAGE = 3;
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newRecordsBadge, setNewRecordsBadge] = useState<number>(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  const loadSupabaseRecords = useCallback(async () => {
    setIsLoadingSupabase(true);
    setSupabaseError(null);
    try {
      const rows = await fetchSupabaseDlrRecords(100);
      setSupabaseRecords(rows);
      setIsOffline(false);
    } catch (err) {
      setSupabaseError(err instanceof Error ? err.message : 'Failed to fetch cloud records');
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('network') ||
        msg.includes('failed to fetch') ||
        msg.includes('connection') ||
        msg.includes('internet')
      ) {
        setIsOffline(true);
      }
    } finally {
      setIsLoadingSupabase(false);
    }
  }, []);

  const checkConnectivity = useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      const state = await Network.getNetworkStateAsync();
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      if (!offline) {
        loadSupabaseRecords();
        fetchCatalog(true)
          .then((list) => {
            setCatalogStatus(`${list.length.toLocaleString()} SKUs loaded (Online)`);
          })
          .catch(() => {
            setCatalogStatus('Catalog error — Internet connection required');
          });
      }
      return !offline;
    } catch {
      try {
        const res = await fetch('https://clients3.google.com/generate_204', { method: 'HEAD' });
        const online = res.status === 204 || res.ok;
        setIsOffline(!online);
        return online;
      } catch {
        setIsOffline(true);
        return false;
      }
    } finally {
      setIsCheckingConnection(false);
    }
  }, [loadSupabaseRecords]);

  const handleDeleteRecord = useCallback(
    (record: SupabaseDLRRow) => {
      if (!record.id) return;
      Alert.alert(
        'Delete Record',
        `Are you sure you want to permanently delete SKU ${record.SKU || record.UPC || 'Item'} (${record.Reason})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(record.id);
              try {
                await deleteSupabaseDlrRecord(record.id);
                feedback('success');
                showNotification(
                  'success',
                  'RECORD DELETED',
                  `SKU ${record.SKU || record.UPC || 'Record'} was deleted.`
                );
                setSupabaseRecords((prev) => prev.filter((r) => r.id !== record.id));
              } catch (err) {
                feedback('error');
                showNotification(
                  'error',
                  'DELETE FAILED',
                  err instanceof Error ? err.message : 'Could not delete record'
                );
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [showNotification]
  );

  useEffect(() => {
    let active = true;
    checkConnectivity();
    fetchCatalog()
      .then((list) => {
        if (active) {
          setIsOffline(false);
          setCatalogStatus(`${list.length.toLocaleString()} SKUs loaded (Online)`);
        }
      })
      .catch(() => {
        if (active) {
          setCatalogStatus('Catalog error — Internet connection required');
        }
      });

    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Network.addNetworkStateListener((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        if (active) {
          setIsOffline(offline);
          if (!offline) {
            loadSupabaseRecords();
          }
        }
      });
    } catch {}

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [checkConnectivity, loadSupabaseRecords]);

  const resetFlow = useCallback(() => {
    setDraft(null);
    setPhotoIndex(0);
    setPreviewUri(null);
    setRetakeKey(null);
    setTorchEnabled(false);
    setSubmitted(false);
    setSubmitError(null);
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
        draftRef.current = record;
        setDraft(record);
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
      if (!isScanActiveRef.current || step !== 'SCAN' || isLookingUpRef.current) return;
      if (scanCooldown.current) return;
      scanCooldown.current = true;
      setTimeout(() => {
        scanCooldown.current = false;
      }, 1200);
      setIsScanActive(false);
      isScanActiveRef.current = false;
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

  const updateDraft = useCallback((updater: (record: DLRLocalRecord) => DLRLocalRecord) => {
    setDraft((prev) => {
      if (!prev) return null;
      const next = updater(prev);
      draftRef.current = next;
      return next;
    });
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
    updateDraft((record) => ({ ...record }));
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
    updateDraft((record) => ({
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
    updateDraft((record) => {
      const uploadedUrls = { ...(record.uploadedUrls ?? {}) };
      delete uploadedUrls[key];
      return {
        ...record,
        photos: { ...record.photos, [key]: previewUri },
        uploadedUrls,
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
    setSubmitError(null);
    setProgressPercent(0.08);
    setProgressText('Preparing photo assets…');

    try {
      const urls: Partial<Record<DLRPhotoKey, string>> = { ...(record.uploadedUrls ?? {}) };

      for (let i = 0; i < PHOTO_STEPS.length; i++) {
        const stepConfig = PHOTO_STEPS[i];
        if (urls[stepConfig.key]) continue;
        const localUri = record.photos[stepConfig.key];
        if (!localUri) {
          throw new Error(`${stepConfig.title} is missing`);
        }
        setProgressPercent(0.15 + (i * 0.24));
        setProgressText(`Optimizing ${stepConfig.title} (${i + 1}/${PHOTO_STEPS.length})…`);
        const compressedUri = await compressImage(localUri);
        setProgressPercent(0.27 + (i * 0.24));
        setProgressText(`Uploading ${stepConfig.title} (${i + 1}/${PHOTO_STEPS.length})…`);
        urls[stepConfig.key] = await uploadToCloudinary(
          compressedUri,
          buildDlrImageName(record, stepConfig.key)
        );

        updateDraft((prev) => ({
          ...prev,
          uploadedUrls: { ...urls },
          updatedAt: new Date().toISOString(),
        }));
      }

      setProgressPercent(0.9);
      setProgressText('Saving record to cloud database…');
      const finalRecord = draftRef.current ?? record;
      const payload = buildSupabasePayload({ ...finalRecord, uploadedUrls: urls });
      if (!payload) throw new Error('Record is incomplete');

      const { error } = await supabase.from('dlr_records').insert([payload]);
      if (error) throw new Error(error.message);

      setProgressPercent(1.0);
      feedback('success');
      setSubmitted(true);
      setNewRecordsBadge((prev) => prev + 1);
      loadSupabaseRecords();
      showNotification(
        'success',
        'RECORD SUBMITTED',
        'DLR record uploaded and saved successfully'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      feedback('error');
      setSubmitError(message);
      showNotification(
        'error',
        'ONLINE SUBMISSION FAILED',
        'Active internet connection is required. Please check your network and try again.'
      );
    } finally {
      setSubmitting(false);
      setProgressText('');
      setProgressPercent(undefined);
    }
  }, [loadSupabaseRecords, showNotification, submitting, updateDraft]);

  const openRecordsModal = useCallback(() => {
    setNewRecordsBadge(0);
    setRecordsPage(1);
    setRecordsModalVisible(true);
    loadSupabaseRecords();
  }, [loadSupabaseRecords]);

  const notificationColors: Record<string, string> = {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  };

  const currentPhotoStep = PHOTO_STEPS[Math.min(photoIndex, PHOTO_STEPS.length - 1)];
  const capturedCount = draft ? PHOTO_STEPS.filter((s) => draft.photos[s.key]).length : 0;

  const renderOfflineState = () => (
    <View className="flex-1 items-center justify-center px-6 pb-12">
      <View
        className={`mb-6 items-center justify-center rounded-3xl p-6 ${
          isDark ? 'bg-[#1f1f22]' : 'bg-[#ffffff]'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 4,
        }}>
        <Image
          source={require('../assets/no-wifi.png')}
          style={{ width: 140, height: 140 }}
          resizeMode="contain"
        />
      </View>

      <View className="mb-2.5 flex-row items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">
        <View className="h-2 w-2 rounded-full bg-red-500" />
        <Text className="font-jetbrains text-[10px] font-bold text-red-500">
          OFFLINE MODE
        </Text>
      </View>

      <Text className={`text-center font-hanken text-xl font-bold ${textPrimaryClass}`}>
        No Internet Connection
      </Text>
      <Text className={`mt-2 max-w-[290px] text-center font-hanken text-xs leading-5 ${textSecondaryClass}`}>
        {'Damage & Lost Record creation requires an active internet connection to verify items, upload evidence photos, and save records in real-time.'}
      </Text>

      <TouchableOpacity
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
          checkConnectivity();
        }}
        disabled={isCheckingConnection}
        activeOpacity={0.8}
        className="mt-6 h-12 min-w-[200px] flex-row items-center justify-center gap-2 rounded-xl bg-[#e5005c] px-6 shadow-lg shadow-[#e5005c]/30">
        {isCheckingConnection ? (
          <ActivityIndicator size={16} color="#ffffff" />
        ) : (
          <RefreshCw color="#ffffff" size={16} />
        )}
        <Text className="font-jetbrains text-xs font-bold uppercase tracking-wider text-white">
          {isCheckingConnection ? 'Checking…' : 'Check Connection'}
        </Text>
      </TouchableOpacity>
    </View>
  );

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
      <View className="flex-1">
        {/* Online-First Reminder Banner */}
        <View className="mx-3 mb-2.5 flex-row items-center gap-2.5 rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-3 py-2.5">
          <Wifi color="#3b82f6" size={16} />
          <View className="flex-1">
            <Text className="font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#3b82f6]">
              Online Connection Required
            </Text>
            <Text className={`font-hanken text-[10px] ${textSecondaryClass}`}>
              You must be connected to the internet to look up items and sync records in real-time.
            </Text>
          </View>
        </View>

        <View className="mx-3 mb-3 flex-1 overflow-hidden rounded-xl border border-[#3f3f46]">
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchEnabled}
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
            <View
              className={`h-52 w-[78%] rounded-2xl border-2 ${
                isScanActive
                  ? 'border-[#e5005c] bg-[#e5005c]/10'
                  : 'border-[#a1a1aa]/40 bg-black/10'
              }`}>
              {isScanActive ? (
                <View className="flex-1 items-center justify-center">
                  <View className="h-0.5 w-[85%] bg-[#e5005c] shadow-lg shadow-[#e5005c]" />
                </View>
              ) : null}
            </View>

            <View className="mt-4 rounded-lg bg-black/70 px-4 py-2">
              <Text className="font-jetbrains text-xs font-bold text-white">
                {isLookingUp
                  ? 'MATCHING ITEM…'
                  : isScanActive
                  ? '⚡ SCANNING ACTIVE — KEEP HOLDING'
                  : 'HOLD BUTTON BELOW TO SCAN'}
              </Text>
            </View>
            {catalogStatus ? (
              <View className="mt-2 rounded-lg bg-black/50 px-3 py-1">
                <Text className="font-jetbrains text-[10px] text-[#a1a1aa]">{catalogStatus}</Text>
              </View>
            ) : null}
          </View>

          <View className="absolute bottom-0 left-0 right-0 items-center px-4 pb-4">
            {isLookingUp ? (
              <View className="mb-3 w-56 items-center rounded-xl bg-black/80 px-4 py-2.5">
                <Text className="mb-1.5 font-jetbrains text-xs font-bold text-white">
                  Matching item in catalog…
                </Text>
                <LoadingBar height={3} color="#e5005c" />
              </View>
            ) : null}

            {/* Hold to Scan Primary Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPressIn={() => {
                setIsScanActive(true);
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }}
              onPressOut={() => {
                setIsScanActive(false);
              }}
              disabled={isLookingUp}
              className={`h-14 w-full flex-row items-center justify-center gap-2.5 rounded-2xl border ${
                isScanActive
                  ? 'border-[#e5005c] bg-[#e5005c]'
                  : 'border-[#e5005c] bg-[#e5005c]/15'
              }`}>
              <Scan color={isScanActive ? '#ffffff' : '#e5005c'} size={20} />
              <Text
                className={`font-jetbrains text-xs font-bold uppercase tracking-wider ${
                  isScanActive ? 'text-[#ffffff]' : 'text-[#e5005c]'
                }`}>
                {isScanActive ? 'SCANNING… KEEP HOLDING' : 'HOLD TO SCAN BARCODE'}
              </Text>
            </TouchableOpacity>

            {/* Secondary Actions: Torch + Manual Entry */}
            <View className="mt-2.5 w-full flex-row items-center justify-between gap-2.5">
              <TouchableOpacity
                onPress={() => setTorchEnabled(!torchEnabled)}
                className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border ${
                  torchEnabled
                    ? 'border-[#f59e0b] bg-[#f59e0b]/25'
                    : 'border-white/20 bg-black/60'
                }`}>
                <Flashlight color={torchEnabled ? '#f59e0b' : '#ffffff'} size={15} />
                <Text
                  className={`font-jetbrains text-[10px] font-bold ${
                    torchEnabled ? 'text-[#f59e0b]' : 'text-white'
                  }`}>
                  {torchEnabled ? 'FLASH ON' : 'FLASH OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setManualModalVisible(true)}
                className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-black/60">
                <Search color="#ffffff" size={14} />
                <Text className="font-jetbrains text-[10px] font-bold text-white">
                  MANUAL CODE
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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

        {/* Online-First Submission Notice */}
        <View className="mt-3 flex-row items-center gap-2.5 rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-3">
          <Wifi color="#3b82f6" size={16} />
          <View className="flex-1">
            <Text className="font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#3b82f6]">
              Direct Cloud Submission
            </Text>
            <Text className={`font-hanken text-[10px] ${textSecondaryClass}`}>
              Photos and records are uploaded and synced directly in real-time.
            </Text>
          </View>
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

        {/* Submit Error Card with Retry */}
        {submitError ? (
          <View className="mt-3 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-3.5">
            <View className="flex-row items-center gap-2">
              <AlertTriangle color="#ef4444" size={16} />
              <Text className="font-jetbrains text-xs font-bold text-[#ef4444]">
                ONLINE SUBMISSION FAILED
              </Text>
            </View>
            <Text className="mt-1 font-hanken text-xs text-[#ef4444]">{submitError}</Text>
            <Text className={`mt-1 font-hanken text-[10px] ${textSecondaryClass}`}>
              You must have an active internet connection to create and submit DLR records.
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              className="mt-2.5 self-start rounded-lg bg-[#ef4444] px-3.5 py-1.5">
              <Text className="font-jetbrains text-[10px] font-bold text-white">RETRY UPLOAD</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {submitting ? (
          <View className={`mt-4 rounded-xl border p-4 ${cardBgClass}`}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                {progressText || 'Processing submission…'}
              </Text>
              {progressPercent !== undefined ? (
                <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                  {Math.round(progressPercent * 100)}%
                </Text>
              ) : null}
            </View>
            <LoadingBar progress={progressPercent} height={6} color="#e5005c" />
            <Text className={`mt-2 font-hanken text-[10px] ${textSecondaryClass}`}>
              Uploading photos and syncing in real-time…
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
      <View className={`flex-row items-center gap-2.5 border-b px-4 py-3 ${headerBgClass}`}>
        {!embedded ? (
          <TouchableOpacity
            onPress={() => {
              if (submitted) {
                resetFlow();
              } else if (navigation?.goBack) {
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
          <Text
            className={`font-jetbrains text-[9px] font-semibold ${
              isOffline ? 'text-[#ef4444]' : 'text-[#22c55e]'
            }`}>
            {isOffline ? 'OFFLINE · CONNECTION REQUIRED' : 'ONLINE FIRST · DIRECT CLOUD'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={openRecordsModal}
          activeOpacity={0.7}
          className="relative flex-row items-center gap-1.5 rounded-lg border border-[#e5005c]/40 bg-[#e5005c]/10 px-2.5 py-1.5">
          <Database color="#e5005c" size={13} />
          <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
            RECORDS ({supabaseRecords.length})
          </Text>
          {newRecordsBadge > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#e5005c',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                borderWidth: 1.5,
                borderColor: isDark ? '#131316' : '#ffffff',
              }}>
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 8,
                  fontFamily: 'JetBrains Mono',
                  fontWeight: '800',
                }}>
                {newRecordsBadge > 9 ? '9+' : `+${newRecordsBadge}`}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {isOffline ? (
        renderOfflineState()
      ) : (
        <>
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
        </>
      )}

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

      {/* Cloud Records Modal */}
      <Modal visible={recordsModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/70">
          <View className={`max-h-[90%] rounded-t-2xl border-t px-4 pb-8 pt-4 ${cardBgClass}`}>
            {/* Header */}
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Database color="#e5005c" size={18} />
                <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                  Cloud Records
                </Text>
                <View className="rounded-full bg-[#e5005c]/15 px-2 py-0.5">
                  <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                    {supabaseRecords.length}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={loadSupabaseRecords}
                  disabled={isLoadingSupabase}
                  className="rounded-full border border-[#3f3f46] p-1.5">
                  <RefreshCw color={isLoadingSupabase ? '#e5005c' : '#a1a1aa'} size={14} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRecordsModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="rounded-full border border-[#3f3f46] p-1.5">
                  <X color="#a1a1aa" size={14} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search filter input */}
            <View
              className={`mb-3 flex-row items-center rounded-lg border px-3 py-1.5 ${inputBgClass}`}>
              <Search color="#a1a1aa" size={14} />
              <TextInput
                value={recordsSearchQuery}
                onChangeText={(text) => {
                  setRecordsSearchQuery(text);
                  setRecordsPage(1);
                }}
                placeholder="Search SKU, reason, store…"
                placeholderTextColor="#71717a"
                className={`ml-2 flex-1 font-jetbrains text-xs ${textPrimaryClass}`}
              />
              {recordsSearchQuery ? (
                <TouchableOpacity
                  onPress={() => {
                    setRecordsSearchQuery('');
                    setRecordsPage(1);
                  }}>
                  <X color="#a1a1aa" size={14} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Records Content */}
            {isLoadingSupabase ? (
              <View className="items-center justify-center py-14 px-6">
                <Text className={`mb-3 font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
                  Fetching records from cloud…
                </Text>
                <View className="w-full max-w-[240px]">
                  <LoadingBar height={4} color="#e5005c" />
                </View>
                <Text className={`mt-2 font-hanken text-[10px] ${textSecondaryClass}`}>
                  Connecting to cloud database
                </Text>
              </View>
            ) : supabaseError ? (
              <View className="my-6 items-center rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4">
                <AlertTriangle color="#ef4444" size={24} />
                <Text className="mt-2 text-center font-hanken text-xs font-bold text-[#ef4444]">
                  {supabaseError}
                </Text>
                <Text className={`mt-1 text-center font-hanken text-[10px] ${textSecondaryClass}`}>
                  Internet connection required to load database records.
                </Text>
                <TouchableOpacity
                  onPress={loadSupabaseRecords}
                  className="mt-3 rounded-lg bg-[#ef4444] px-4 py-2">
                  <Text className="font-jetbrains text-[10px] font-bold text-white">RETRY</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {(() => {
                  const filtered = supabaseRecords.filter((r) => {
                    if (!recordsSearchQuery.trim()) return true;
                    const q = recordsSearchQuery.toLowerCase();
                    return (
                      (r.SKU && r.SKU.toLowerCase().includes(q)) ||
                      (r.UPC && r.UPC.toLowerCase().includes(q)) ||
                      (r.Description && r.Description.toLowerCase().includes(q)) ||
                      (r.Reason && r.Reason.toLowerCase().includes(q)) ||
                      (r.SecondReason && r.SecondReason.toLowerCase().includes(q)) ||
                      (r['Store Code'] && r['Store Code'].toLowerCase().includes(q)) ||
                      (r.Department && r.Department.toLowerCase().includes(q)) ||
                      (r.SubDep && r.SubDep.toLowerCase().includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <View className="items-center py-14">
                        <Database color="#52525b" size={36} />
                        <Text className={`mt-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
                          {recordsSearchQuery
                            ? 'No matching records'
                            : 'No records found'}
                        </Text>
                        <Text
                          className={`mt-1 text-center font-hanken text-xs ${textSecondaryClass}`}>
                          {recordsSearchQuery
                            ? 'Try refining your search keyword.'
                            : 'Submitted records will appear here once saved.'}
                        </Text>
                      </View>
                    );
                  }

                  const totalPages = Math.max(1, Math.ceil(filtered.length / RECORDS_PER_PAGE));
                  const currentPage = Math.min(Math.max(1, recordsPage), totalPages);
                  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
                  const paginated = filtered.slice(startIndex, startIndex + RECORDS_PER_PAGE);

                  return (
                    <>
                      {/* Records Summary Bar */}
                      <View className="mb-2 flex-row items-center justify-between px-1">
                        <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                          Showing {startIndex + 1}–{Math.min(startIndex + RECORDS_PER_PAGE, filtered.length)} of {filtered.length} records
                        </Text>
                        <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                          Page {currentPage}/{totalPages}
                        </Text>
                      </View>

                      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                        {paginated.map((record) => {
                          const images = Array.isArray(record.image) ? record.image : [];
                          const photoLabels = ['Qty Overview', 'Damage Detail', 'Barcode'];

                          return (
                            <View
                              key={record.id || `${record.SKU}_${record.created_at}`}
                              className={`mb-3 rounded-xl border p-3.5 ${inputBgClass}`}>
                              {/* Header Row */}
                              <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2">
                                  <View className="rounded bg-[#22c55e]/15 px-1.5 py-0.5">
                                    <Text className="font-jetbrains text-[8px] font-bold text-[#22c55e]">
                                      SYNCED
                                    </Text>
                                  </View>
                                  <Text
                                    className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}
                                    numberOfLines={1}>
                                    SKU {record.SKU || record.UPC || '—'}
                                  </Text>
                                  {record.Qty ? (
                                    <View className="rounded bg-[#e5005c]/15 px-1.5 py-0.5">
                                      <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">
                                        Qty {record.Qty}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                <View className="flex-row items-center gap-2">
                                  <Text className={`font-jetbrains text-[9px] ${textSecondaryClass}`}>
                                    {formatRecordTime(record.created_at)}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => handleDeleteRecord(record)}
                                    disabled={deletingId === record.id}
                                    activeOpacity={0.6}
                                    className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5">
                                    {deletingId === record.id ? (
                                      <ActivityIndicator size={12} color="#ef4444" />
                                    ) : (
                                      <Trash2 color="#ef4444" size={13} />
                                    )}
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Description */}
                              {record.Description ? (
                                <Text
                                  className={`mt-1 font-hanken text-xs font-semibold ${textPrimaryClass}`}
                                  numberOfLines={2}>
                                  {record.Description}
                                </Text>
                              ) : null}

                              {/* Reasons & Store */}
                              <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                                <View className="rounded-md border border-[#e5005c]/40 bg-[#e5005c]/10 px-2 py-0.5">
                                  <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">
                                    {record.Reason}
                                  </Text>
                                </View>
                                {record.SecondReason ? (
                                  <View className="rounded-md border border-[#a1a1aa]/30 bg-[#a1a1aa]/10 px-2 py-0.5">
                                    <Text
                                      className={`font-jetbrains text-[9px] font-medium ${textSecondaryClass}`}>
                                      {record.SecondReason}
                                    </Text>
                                  </View>
                                ) : null}
                                {record['Store Code'] ? (
                                  <View className="ml-auto flex-row items-center gap-1 rounded bg-[#3f3f46]/25 px-2 py-0.5">
                                    <Building2 color="#a1a1aa" size={10} />
                                    <Text
                                      className={`max-w-[150px] font-jetbrains text-[9px] ${textSecondaryClass}`}
                                      numberOfLines={1}>
                                      {record['Store Code']}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              {/* Department & Pricing */}
                              {record.Department || record.SubDep || record.Price || record.Cost ? (
                                <View className="mt-2 flex-row flex-wrap items-center justify-between border-t border-[#3f3f46]/20 pt-1.5">
                                  <Text
                                    className={`font-hanken text-[10px] ${textSecondaryClass}`}
                                    numberOfLines={1}>
                                    {[record.Department, record.SubDep].filter(Boolean).join(' · ')}
                                  </Text>
                                  <Text
                                    className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                                    {record.Price ? `₱${record.Price}` : ''}
                                    {record.Cost ? ` · Cost ₱${record.Cost}` : ''}
                                  </Text>
                                </View>
                              ) : null}

                              {/* Image Thumbnails */}
                              {images.length > 0 ? (
                                <View className="mt-2.5 flex-row items-center gap-2">
                                  {images.map((imgUrl, imgIdx) => (
                                    <TouchableOpacity
                                      key={imgIdx}
                                      onPress={() => setPreviewPhotoUrl(imgUrl)}
                                      activeOpacity={0.8}
                                      className={`h-14 flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#3f3f46]/60 ${
                                        isDark ? 'bg-[#131316]' : 'bg-[#fafafa]'
                                      }`}>
                                      <Image
                                        source={{ uri: imgUrl }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="cover"
                                      />
                                      <View className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5">
                                        <Text className="text-center font-jetbrains text-[8px] font-bold text-white">
                                          {photoLabels[imgIdx] || `Photo ${imgIdx + 1}`}
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </ScrollView>

                      {/* Pagination Controls */}
                      {totalPages > 1 ? (
                        <View className={`mt-3 flex-row items-center justify-between rounded-xl border p-2 ${cardBgClass}`}>
                          <TouchableOpacity
                            onPress={() => {
                              setRecordsPage((p) => Math.max(1, p - 1));
                              Haptics.selectionAsync();
                            }}
                            disabled={currentPage === 1}
                            className={`flex-row items-center gap-1 rounded-lg border px-3 py-2 ${
                              currentPage === 1
                                ? 'border-[#3f3f46]/40 opacity-30'
                                : 'border-[#e5005c]/40 bg-[#e5005c]/10'
                            }`}>
                            <ChevronLeft
                              color={currentPage === 1 ? '#a1a1aa' : '#e5005c'}
                              size={14}
                            />
                            <Text
                              className={`font-jetbrains text-xs font-bold ${
                                currentPage === 1 ? textSecondaryClass : 'text-[#e5005c]'
                              }`}>
                              PREV
                            </Text>
                          </TouchableOpacity>

                          <View className="items-center">
                            <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
                              Page {currentPage} of {totalPages}
                            </Text>
                            <Text className={`font-jetbrains text-[9px] ${textSecondaryClass}`}>
                              {RECORDS_PER_PAGE} items / page
                            </Text>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              setRecordsPage((p) => Math.min(totalPages, p + 1));
                              Haptics.selectionAsync();
                            }}
                            disabled={currentPage === totalPages}
                            className={`flex-row items-center gap-1 rounded-lg border px-3 py-2 ${
                              currentPage === totalPages
                                ? 'border-[#3f3f46]/40 opacity-30'
                                : 'border-[#e5005c]/40 bg-[#e5005c]/10'
                            }`}>
                            <Text
                              className={`font-jetbrains text-xs font-bold ${
                                currentPage === totalPages ? textSecondaryClass : 'text-[#e5005c]'
                              }`}>
                              NEXT
                            </Text>
                            <ChevronRight
                              color={currentPage === totalPages ? '#a1a1aa' : '#e5005c'}
                              size={14}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </>
                  );
                })()}
              </>
            )}

            {/* Bottom Close Action */}
            <TouchableOpacity
              onPress={() => setRecordsModalVisible(false)}
              className={`mt-3 items-center justify-center rounded-xl border py-2.5 ${inputBgClass}`}>
              <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Photo Viewer Modal */}
      <Modal visible={Boolean(previewPhotoUrl)} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/90 p-4">
          <TouchableOpacity
            onPress={() => setPreviewPhotoUrl(null)}
            className="absolute right-4 top-12 z-50 rounded-full border border-white/20 bg-black/70 p-2.5">
            <X color="#ffffff" size={20} />
          </TouchableOpacity>
          {previewPhotoUrl ? (
            <Image
              source={{ uri: previewPhotoUrl }}
              style={{ width: '100%', height: '75%' }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
