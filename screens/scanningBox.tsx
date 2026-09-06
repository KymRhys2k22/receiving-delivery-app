import React, { useState, useCallback, useRef, useEffect, useMemo, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
  FlatList,
  PanResponder,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Keyboard,
  CheckCircle,
  X,
  AlertTriangle,
  Scan,
  ChevronUp,
  ChevronDown,
  Bluetooth,
} from 'lucide-react-native';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/theme';
import { MANIFEST_CIDS_KEY, SCANNED_CIDS_KEY, type BoxManifestRecord } from '../utils/storage';

const playScanFeedback = async (type: 'success' | 'warning' | 'error') => {
  // 1. Tactile Haptic Vibration Feedback
  try {
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {}

  // 2. Real-time Acoustic Web Audio Synthesizer (Instant zero-latency scanner beep)
  if (typeof window !== 'undefined') {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (type === 'success') {
          // High crisp Zebra-style barcode scanner beep (1200 Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
          return;
        } else if (type === 'warning') {
          // Double warning pulse tone (680 Hz)
          [0, 0.11].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(680, ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.08);
          });
          return;
        } else {
          // Low error buzzer tone (260 Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(260, ctx.currentTime);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
          return;
        }
      }
    } catch {}
  }

  // 3. Fallback to HTML5 Audio / expo-av
  try {
    const uri =
      type === 'success'
        ? 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10EBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YV9vT18Ae3h8eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5eXp5'
        : type === 'warning'
          ? 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10EBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YV9vT18AeHl2dHNyc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc3Jzc'
          : 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10EBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YV9vT18AYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg';

    if (typeof window !== 'undefined' && (window as any).Audio) {
      const sound = new (window as any).Audio(uri);
      sound.play().catch(() => {});
      return;
    }
  } catch {}
};

export default function ScanningBoxScreen({ navigation: propNavigation }: { navigation?: any } = {}) {
  const contextNavigation = useContext(NavigationContext);
  const navigation = propNavigation || contextNavigation;
  const { isDark } = useTheme();

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const tabBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';
  const footerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'unscanned' | 'scanned'>('unscanned');
  const [unscannedBoxes, setUnscannedBoxes] = useState<BoxManifestRecord[]>([]);
  const [scannedBoxes, setScannedBoxes] = useState<BoxManifestRecord[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [confirmCidModal, setConfirmCidModal] = useState<BoxManifestRecord | null>(null);

  // Full screen tabs mode (covers camera when swiped up)
  const [isFullScreenTabs, setIsFullScreenTabs] = useState(false);
  const [bluetoothInput, setBluetoothInput] = useState('');
  const bluetoothInputRef = useRef<TextInput>(null);
  const liveBufferRef = useRef('');
  const scanBufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const refocusBluetoothInput = useCallback(() => {
    if (isFullScreenTabs) {
      setTimeout(() => {
        bluetoothInputRef.current?.focus();
      }, 150);
    }
  }, [isFullScreenTabs]);

  // Focus bluetooth input automatically whenever swiped up into full screen tabs
  useEffect(() => {
    if (isFullScreenTabs) {
      setTimeout(() => {
        bluetoothInputRef.current?.focus();
      }, 100);
    }
  }, [isFullScreenTabs]);

  useEffect(() => {
    return () => {
      if (scanBufferTimerRef.current) {
        clearTimeout(scanBufferTimerRef.current);
      }
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dy) > 15 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -20) {
            // Swiped UP -> Expand tabs to full screen (cover camera)
            setIsFullScreenTabs(true);
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          } else if (gestureState.dy > 20) {
            // Swiped DOWN -> Uncover camera view
            setIsFullScreenTabs(false);
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          }
        },
      }),
    []
  );

  // Hold-to-scan state: barcode scanning active only while holding the button
  const [isHoldScanning, setIsHoldScanning] = useState(false);
  const isHoldScanningRef = useRef(false);

  useEffect(() => {
    isHoldScanningRef.current = isHoldScanning;
  }, [isHoldScanning]);

  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Keep live refs to avoid stale closure issues during fast camera scanning
  const unscannedRef = useRef<BoxManifestRecord[]>([]);
  const scannedRef = useRef<BoxManifestRecord[]>([]);
  const masterCidsRef = useRef<BoxManifestRecord[]>([]);

  useEffect(() => {
    unscannedRef.current = unscannedBoxes;
  }, [unscannedBoxes]);

  useEffect(() => {
    scannedRef.current = scannedBoxes;
  }, [scannedBoxes]);

  // Automatically request camera permission if not granted
  useEffect(() => {
    if (!permission || (!permission.granted && permission.canAskAgain)) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = useCallback(
    (type: 'success' | 'warning' | 'error', title: string, message: string) => {
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

  // Debounce: prevent the same barcode from firing twice in quick succession
  const scanCooldown = useRef(false);

  // Animated laser sweep - restarts sweep animation cleanly whenever user holds the button
  const [laserAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (isHoldScanning) {
      laserAnim.setValue(0);
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      laserAnim.stopAnimation();
      laserAnim.setValue(0);
    }

    return () => {
      if (animLoop) {
        animLoop.stop();
      }
    };
  }, [isHoldScanning, laserAnim]);

  const normalizeBox = (item: any): BoxManifestRecord => {
    if (typeof item === 'string') {
      return { cid: item.trim(), trf: '' };
    }
    return {
      cid: (item?.cid || '').trim(),
      trf: (item?.trf || '').trim(),
    };
  };

  /** Deduplicate Boxes (case-insensitive by CID) so duplicate rows are merged into one */
  const deduplicateBoxes = (boxes: any[]): BoxManifestRecord[] => {
    const map = new Map<string, BoxManifestRecord>();
    for (const b of boxes) {
      const normalized = normalizeBox(b);
      if (!normalized.cid) continue;
      const upper = normalized.cid.toUpperCase();
      if (!map.has(upper)) {
        map.set(upper, normalized);
      } else if (normalized.trf && !map.get(upper)!.trf) {
        map.set(upper, normalized);
      }
    }
    return Array.from(map.values());
  };

  // Reload manifest and saved scanned CIDs from AsyncStorage on focus
  const loadSavedProgress = useCallback(async () => {
    try {
      const storedManifest = await AsyncStorage.getItem(MANIFEST_CIDS_KEY);
      const storedScanned = await AsyncStorage.getItem(SCANNED_CIDS_KEY);

      if (storedManifest) {
        const rawManifest = JSON.parse(storedManifest) as any[];
        const uniqueBoxes = deduplicateBoxes(Array.isArray(rawManifest) ? rawManifest : []);
        masterCidsRef.current = uniqueBoxes;

        const rawScanned = storedScanned ? (JSON.parse(storedScanned) as any[]) : [];
        const scannedList = deduplicateBoxes(Array.isArray(rawScanned) ? rawScanned : []);
        setScannedBoxes(scannedList);

        const scannedSet = new Set(scannedList.map((s) => s.cid.toUpperCase()));
        const remainingUnscanned = uniqueBoxes.filter((c) => !scannedSet.has(c.cid.toUpperCase()));
        setUnscannedBoxes(remainingUnscanned);
      } else {
        masterCidsRef.current = [];
        setScannedBoxes([]);
        setUnscannedBoxes([]);
      }
    } catch {
      // Storage read failed — leave list as-is
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedProgress();
    }, [loadSavedProgress])
  );

  const totalBoxes = unscannedBoxes.length + scannedBoxes.length;
  const progressPct = totalBoxes > 0 ? Math.round((scannedBoxes.length / totalBoxes) * 100) : 0;

  /** Secure, exact case-insensitive matcher by CID NO or TRF NO */
  const findMatchingCid = (input: string, list: BoxManifestRecord[]): BoxManifestRecord | null => {
    const raw = input.trim();
    if (!raw) return null;
    const cleanUpper = raw.toUpperCase();

    // 1. Exact match on CID or TRF
    const exact = list.find((c) => c.cid.trim() === raw || (c.trf && c.trf.trim() === raw));
    if (exact) return exact;

    // 2. Case-insensitive exact match on CID or TRF
    const caseInsensitive = list.find(
      (c) =>
        c.cid.trim().toUpperCase() === cleanUpper ||
        (c.trf && c.trf.trim().toUpperCase() === cleanUpper)
    );
    if (caseInsensitive) return caseInsensitive;

    // 3. URL query parameter or prefixed string exact token extraction (e.g. "CID:112PK0000" or "?cid=112PK0000")
    if (raw.includes(':') || raw.includes('=') || raw.includes('/')) {
      const tokens = raw.split(/[:=/?#&]+/).map((t) => t.trim().toUpperCase());
      const tokenMatch = list.find(
        (c) =>
          tokens.includes(c.cid.trim().toUpperCase()) ||
          (c.trf && tokens.includes(c.trf.trim().toUpperCase()))
      );
      if (tokenMatch) return tokenMatch;
    }

    return null;
  };

  /** Move a CID from unscanned → scanned, or notify if already scanned / missing */
  const handleScan = useCallback(
    (code: string) => {
      const raw = code.trim();
      if (!raw) return;

      const currentUnscanned = unscannedRef.current;
      const currentScanned = scannedRef.current;
      const masterCids = masterCidsRef.current;

      // 1. Check unscanned list (First time scan)
      const unscannedMatch = findMatchingCid(raw, currentUnscanned);
      if (unscannedMatch) {
        setUnscannedBoxes((prev) => prev.filter((c) => c.cid !== unscannedMatch.cid));
        setScannedBoxes((prev) => {
          const updated = prev.some((c) => c.cid === unscannedMatch.cid) ? prev : [unscannedMatch, ...prev];
          AsyncStorage.setItem(SCANNED_CIDS_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        setLastScanned(unscannedMatch.cid);
        showNotification(
          'success',
          '✓ SCANNED SUCCESSFULLY',
          `Box CID ${unscannedMatch.cid}${unscannedMatch.trf ? ` (TRF: ${unscannedMatch.trf})` : ''} moved to Scanned`
        );
        playScanFeedback('success');
        return;
      }

      // 2. Check scanned list or master list (Already scanned)
      const scannedMatch = findMatchingCid(raw, currentScanned) || findMatchingCid(raw, masterCids);
      if (scannedMatch) {
        showNotification(
          'warning',
          '⚠️ ALREADY SCANNED',
          `Box CID "${scannedMatch.cid}"${scannedMatch.trf ? ` (TRF: ${scannedMatch.trf})` : ''} has ALREADY been scanned!`
        );
        playScanFeedback('warning');
        return;
      }

      // 3. Not found in unscanned, scanned, or master data
      showNotification(
        'error',
        '❌ NOT IN MANIFEST',
        `Scanned code "${raw}" was not found in manifest data`
      );
      playScanFeedback('error');
    },
    [showNotification]
  );

  /** Called by CameraView when a barcode/QR is detected */
  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      // ONLY process scans when the trigger button is actively held down!
      if (!isHoldScanningRef.current) return;

      if (scanCooldown.current) return;
      scanCooldown.current = true;
      setTimeout(() => {
        scanCooldown.current = false;
      }, 1200);
      handleScan(data);
    },
    [handleScan]
  );

  /** Manual entry submit */
  const submitManual = () => {
    if (manualInput.trim()) {
      handleScan(manualInput);
      setManualInput('');
      setShowManual(false);
      refocusBluetoothInput();
    }
  };

  /** Handle physical Bluetooth scanner input and manual input in swipe up mode */
  const handleBluetoothSubmit = (text?: string) => {
    if (scanBufferTimerRef.current) {
      clearTimeout(scanBufferTimerRef.current);
      scanBufferTimerRef.current = null;
    }
    setIsBuffering(false);

    const codeToScan = (typeof text === 'string' ? text : liveBufferRef.current || bluetoothInput)
      .replace(/[\r\n\t]+/g, '')
      .trim();

    liveBufferRef.current = '';
    setBluetoothInput('');

    if (codeToScan) {
      handleScan(codeToScan);
    }
    setTimeout(() => {
      bluetoothInputRef.current?.focus();
    }, 100);
  };

  const handleBluetoothTextChange = (text: string) => {
    const cleanText = text.replace(/[\r\n\t]+/g, '');
    liveBufferRef.current = cleanText;
    setBluetoothInput(cleanText);

    if (scanBufferTimerRef.current) {
      clearTimeout(scanBufferTimerRef.current);
      scanBufferTimerRef.current = null;
    }

    if (cleanText.trim().length > 0) {
      setIsBuffering(true);

      // 0.5-second (500ms) delay before auto-triggering to ensure all digits from physical Bluetooth scanner are fully streamed
      scanBufferTimerRef.current = setTimeout(() => {
        setIsBuffering(false);

        const finalCode = (liveBufferRef.current || cleanText).trim();
        liveBufferRef.current = '';
        setBluetoothInput('');
        scanBufferTimerRef.current = null;

        if (finalCode) {
          handleScan(finalCode);
        }
        setTimeout(() => {
          bluetoothInputRef.current?.focus();
        }, 100);
      }, 500);
    } else {
      setIsBuffering(false);
    }
  };

  const [isTabLoading, setIsTabLoading] = useState(false);

  const handleTabChange = useCallback(
    (newTab: 'unscanned' | 'scanned') => {
      if (newTab === activeTab) return;
      setIsTabLoading(true);
      setActiveTab(newTab);
      setTimeout(() => {
        setIsTabLoading(false);
      }, 150);
    },
    [activeTab]
  );

  const displayBoxes = activeTab === 'unscanned' ? unscannedBoxes : scannedBoxes;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className={`flex-1 ${bgClass}`}
      style={{ flex: 1, backgroundColor: isDark ? '#18181b' : '#ffffff' }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {/* Manual Entry Modal */}
      <Modal visible={showManual} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View
            className={`w-full rounded-xl border p-5 shadow-2xl ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                Manual Entry
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowManual(false);
                  setManualInput('');
                  refocusBluetoothInput();
                }}>
                <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Enter CID NO or TRF NO..."
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              autoFocus
              autoCapitalize="characters"
              className={`mb-4 h-11 rounded-lg border px-3 font-jetbrains text-sm ${
                isDark
                  ? 'border-[#3f3f46] bg-[#131316] text-[#fafafa]'
                  : 'border-[#d4d4d8] bg-[#fafafa] text-[#18181b]'
              }`}
            />
            <TouchableOpacity
              onPress={submitManual}
              activeOpacity={0.8}
              className="items-center justify-center rounded-lg bg-[#e5005c] py-3 active:bg-[#c20050]">
              <Text className="font-jetbrains text-sm font-bold text-[#ffffff]">CONFIRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Add to Scanned Modal */}
      <Modal visible={confirmCidModal !== null} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View
            className={`w-full rounded-xl border p-5 shadow-2xl ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                Confirm Scan
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setConfirmCidModal(null);
                  refocusBluetoothInput();
                }}>
                <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
              </TouchableOpacity>
            </View>

            <Text className={`mb-3 font-hanken text-xs ${textSecondaryClass}`}>
              Do you want to add this box to the scanned list?
            </Text>

            <View
              className={`mb-5 rounded-lg border p-3 ${
                isDark
                  ? 'border-[#ff80ab]/30 bg-[#ff80ab]/10'
                  : 'border-[#e5005c]/30 bg-[#e5005c]/10'
              }`}>
              <Text
                className={`font-jetbrains text-sm font-bold ${
                  isDark ? 'text-[#ffb2c3]' : 'text-[#e5005c]'
                }`}>
                CID NO. : {confirmCidModal?.cid}
              </Text>
              {confirmCidModal?.trf ? (
                <Text
                  className={`mt-1 font-jetbrains text-xs font-semibold ${
                    isDark ? 'text-[#e4e4e7]' : 'text-[#3f3f46]'
                  }`}>
                  TRF NO. : {confirmCidModal.trf}
                </Text>
              ) : null}
            </View>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => {
                  setConfirmCidModal(null);
                  refocusBluetoothInput();
                }}
                className={`flex-1 items-center justify-center rounded-lg border py-3 ${
                  isDark
                    ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                    : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
                }`}>
                <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                  CANCEL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (confirmCidModal) {
                    const target = confirmCidModal;
                    setConfirmCidModal(null);
                    handleScan(target.cid);
                    refocusBluetoothInput();
                  }
                }}
                activeOpacity={0.8}
                className="flex-1 items-center justify-center rounded-lg bg-[#e5005c] py-3 active:bg-[#c20050]">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">PROCEED</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View className={`flex-row items-center gap-3 border-b px-4 py-2.5 ${headerBgClass}`}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color={isDark ? '#fafafa' : '#18181b'} size={22} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className={`font-hanken text-xl font-bold ${textPrimaryClass}`}>Scanning</Text>
        </View>
        {lastScanned && (
          <View className="flex-row items-center gap-1.5 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-1.5">
            <CheckCircle color="#22c55e" size={14} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]" numberOfLines={1}>
              {lastScanned}
            </Text>
          </View>
        )}
      </View>

      {/* Floating Notification Toast Banner */}
      {notification && (
        <View
          style={{ zIndex: 999, elevation: 10 }}
          className={`absolute left-4 right-4 top-24 flex-row items-center gap-3 rounded-xl border p-3.5 shadow-2xl ${
            notification.type === 'success'
              ? 'border-[#22c55e] bg-[#163e26]/95'
              : notification.type === 'warning'
                ? 'border-[#eab308] bg-[#42340a]/95'
                : 'border-[#ef4444] bg-[#451a1a]/95'
          }`}>
          {notification.type === 'success' && <CheckCircle color="#22c55e" size={20} />}
          {notification.type === 'warning' && <AlertTriangle color="#eab308" size={20} />}
          {notification.type === 'error' && <AlertTriangle color="#ef4444" size={20} />}

          <View className="flex-1">
            <Text
              className={`font-hanken text-xs font-bold ${
                notification.type === 'success'
                  ? 'text-[#4ade80]'
                  : notification.type === 'warning'
                    ? 'text-[#fde047]'
                    : 'text-[#fca5a5]'
              }`}>
              {notification.title}
            </Text>
            <Text className="font-jetbrains text-xs text-[#fafafa]" numberOfLines={2}>
              {notification.message}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setNotification(null)}>
            <X color="#a1a1aa" size={18} />
          </TouchableOpacity>
        </View>
      )}

      {/* Camera Area (Hidden when swiped up into full screen tabs) */}
      {!isFullScreenTabs && (
        <View className="relative h-[40%] overflow-hidden bg-black">
          {!permission ? (
            // Permissions loading
            <View className="flex-1 items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#ff80ab" />
              <Text className={`font-hanken text-sm ${textSecondaryClass}`}>Loading camera...</Text>
            </View>
          ) : !permission.granted ? (
            // Permission denied UI
            <View className="flex-1 items-center justify-center gap-3 px-6">
              <AlertTriangle color="#eab308" size={36} />
              <Text className={`text-center font-hanken text-sm ${textSecondaryClass}`}>
                Camera access is required to scan barcodes.
              </Text>
              <TouchableOpacity
                onPress={requestPermission}
                className="rounded-lg bg-[#ff80ab] px-5 py-2.5">
                <Text className="font-jetbrains text-xs font-bold text-[#131316]">
                  GRANT ACCESS
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Live camera with barcode scanning
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={onBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'code128',
                  'code39',
                  'code93',
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'pdf417',
                  'datamatrix',
                  'itf14',
                ],
              }}
            />
          )}

          {/* Overlays — rendered in parent View (absolute) so CameraView has no children */}
          {permission?.granted && (
            <>
              {/* Scanning Brackets */}
              <View
                className={`absolute left-8 top-10 h-12 w-12 border-l-[3px] border-t-[3px] ${
                  isHoldScanning ? 'border-[#ff80ab]' : 'border-[#52525b]'
                }`}
              />
              <View
                className={`absolute right-8 top-10 h-12 w-12 border-r-[3px] border-t-[3px] ${
                  isHoldScanning ? 'border-[#ff80ab]' : 'border-[#52525b]'
                }`}
              />
              <View
                className={`absolute bottom-16 left-8 h-12 w-12 border-b-[3px] border-l-[3px] ${
                  isHoldScanning ? 'border-[#ff80ab]' : 'border-[#52525b]'
                }`}
              />
              <View
                className={`absolute bottom-16 right-8 h-12 w-12 border-b-[3px] border-r-[3px] ${
                  isHoldScanning ? 'border-[#ff80ab]' : 'border-[#52525b]'
                }`}
              />

              {/* Status Badge */}
              <View className="absolute left-0 right-0 top-3 items-center justify-center">
                <View
                  className={`flex-row items-center gap-2 rounded-full border px-3.5 py-1 shadow-md ${
                    isHoldScanning
                      ? 'border-[#ff80ab] bg-[#ff80ab]/20'
                      : 'border-[#3f3f46] bg-black/60'
                  }`}>
                  <View
                    className={`h-2 w-2 rounded-full ${
                      isHoldScanning ? 'bg-[#ff80ab]' : 'bg-[#71717a]'
                    }`}
                  />
                  <Text
                    className={`font-jetbrains text-[11px] font-bold ${
                      isHoldScanning ? 'text-[#ff80ab]' : 'text-[#a1a1aa]'
                    }`}>
                    {isHoldScanning ? 'SCANNER ACTIVE' : 'HOLD BUTTON TO SCAN'}
                  </Text>
                </View>
              </View>

              {/* Animated Laser Line (only visible when holding scan button) */}
              {isHoldScanning && (
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 32,
                    right: 32,
                    height: 2,
                    backgroundColor: '#ef4444',
                    shadowColor: '#ef4444',
                    shadowOpacity: 0.9,
                    shadowRadius: 6,
                    transform: [
                      {
                        translateY: laserAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [35, 250],
                        }),
                      },
                    ],
                  }}
                />
              )}

              {/* Bottom Controls: Hold to Scan Trigger & Manual Entry */}
              <View className="absolute bottom-3 left-4 right-4 flex-row items-center gap-2.5">
                {/* Hold-to-Scan Trigger Button */}
                <TouchableOpacity
                  onPressIn={() => {
                    setIsHoldScanning(true);
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch {}
                  }}
                  onPressOut={() => {
                    setIsHoldScanning(false);
                  }}
                  activeOpacity={0.8}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 shadow-lg ${
                    isHoldScanning
                      ? 'border-[#ff80ab] bg-[#ff80ab]'
                      : 'border-[#ff80ab]/50 bg-[#ff80ab]/10'
                  }`}>
                  <Scan color={isHoldScanning ? '#131316' : '#ff80ab'} size={18} />
                  <Text
                    className={`font-jetbrains text-xs font-extrabold tracking-wider ${
                      isHoldScanning ? 'text-[#131316]' : 'text-[#ff80ab]'
                    }`}>
                    {isHoldScanning ? 'SCANNING...' : 'HOLD TO SCAN'}
                  </Text>
                </TouchableOpacity>

                {/* Manual Entry Button */}
                <TouchableOpacity
                  onPress={() => setShowManual(true)}
                  className={`flex-row items-center gap-1.5 rounded-xl border px-3.5 py-3 ${isDark ? 'border-[#3f3f46] bg-[#2a2a2d]/90' : 'border-[#d4d4d8] bg-white'}`}>
                  <Keyboard color="#a1a1aa" size={16} />
                  <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">MANUAL</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {/* Swipe Up/Down Handle Bar */}
      <TouchableOpacity
        {...panResponder.panHandlers}
        onPress={() => setIsFullScreenTabs((prev) => !prev)}
        activeOpacity={0.8}
        className={`flex-row items-center justify-center gap-1.5 border-b py-2 ${
          isDark ? 'border-[#3f3f46]/60 bg-[#18181b]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
        }`}>
        <View className={`h-1.5 w-10 rounded-full ${isDark ? 'bg-[#3f3f46]' : 'bg-[#d4d4d8]'}`} />
        {isFullScreenTabs ? (
          <View className="flex-row items-center gap-1">
            <ChevronDown color="#ff80ab" size={14} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#ff80ab]">
              SWIPE DOWN / TAP TO SHOW CAMERA
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <ChevronUp color={isDark ? '#a1a1aa' : '#71717a'} size={14} />
            <Text className={`font-jetbrains text-[10px] font-bold ${textSecondaryClass}`}>
              SWIPE UP FOR FULL SCREEN TABS
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Bluetooth & Manual Barcode Scanner Input (Active when swiped up / Camera disabled) */}
      {isFullScreenTabs && (
        <View
          className={`border-b px-4 py-3 shadow-sm ${
            isDark ? 'border-[#3f3f46] bg-[#1a1a1d]' : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <View className="h-6 w-6 items-center justify-center rounded-md bg-[#ff80ab]/15">
                <Bluetooth color="#ff80ab" size={14} />
              </View>
              <Text className="font-jetbrains text-[11px] font-bold text-[#ff80ab]">
                BLUETOOTH SCANNER ACTIVE
              </Text>
            </View>
            <View
              className={`flex-row items-center gap-1.5 rounded-full border px-2 py-0.5 ${
                isBuffering
                  ? 'border-[#eab308]/60 bg-[#eab308]/20'
                  : 'border-[#22c55e]/30 bg-[#22c55e]/10'
              }`}>
              <View
                className={`h-1.5 w-1.5 rounded-full ${
                  isBuffering ? 'bg-[#eab308]' : 'bg-[#22c55e]'
                }`}
              />
              <Text
                className={`font-jetbrains text-[9px] font-bold ${
                  isBuffering ? 'text-[#eab308]' : 'text-[#22c55e]'
                }`}>
                {isBuffering
                  ? 'READING BARCODE...'
                  : '0.5S AUTO-TRIGGER READY'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <View
              className={`flex-1 flex-row items-center rounded-xl border px-3 ${
                isBuffering
                  ? 'border-[#eab308] bg-[#eab308]/5'
                  : isDark
                    ? 'border-[#ff80ab]/40 bg-[#131316]'
                    : 'border-[#ff80ab]/50 bg-[#fafafa]'
              }`}>
              <Scan color={isBuffering ? '#eab308' : '#ff80ab'} size={16} />
              <TextInput
                ref={bluetoothInputRef}
                value={bluetoothInput}
                onChangeText={handleBluetoothTextChange}
                placeholder="Scan or type Box CID NO or TRF NO..."
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus={true}
                blurOnSubmit={false}
                className={`h-11 flex-1 px-2.5 font-jetbrains text-xs ${
                  isDark ? 'text-[#fafafa]' : 'text-[#18181b]'
                }`}
              />
              {bluetoothInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (scanBufferTimerRef.current) {
                      clearTimeout(scanBufferTimerRef.current);
                      scanBufferTimerRef.current = null;
                    }
                    setIsBuffering(false);
                    liveBufferRef.current = '';
                    setBluetoothInput('');
                    bluetoothInputRef.current?.focus();
                  }}
                  className="p-1">
                  <X color={isDark ? '#a1a1aa' : '#71717a'} size={15} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleBluetoothSubmit()}
              activeOpacity={0.8}
              className="h-11 items-center justify-center rounded-xl bg-[#ff80ab] px-4 active:bg-[#ff4081]">
              <Text className="font-jetbrains text-xs font-bold text-[#131316]">SCAN</Text>
            </TouchableOpacity>
          </View>

          <Text className={`mt-1.5 font-hanken text-[10px] ${textSecondaryClass}`}>
            {isBuffering
              ? `⏳ Streaming barcode (${bluetoothInput.length} chars received)... Processing in 0.5s or tap SCAN.`
              : 'Scan Box CID NO or TRF NO with your Bluetooth scanner. 0.5s buffer captures all digits quickly and accurately.'}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View className={`flex-row border-b ${tabBgClass}`}>
        <TouchableOpacity
          onPress={() => handleTabChange('unscanned')}
          className={`flex-1 items-center justify-center py-4 ${
            activeTab === 'unscanned' ? 'border-b-2 border-[#ff80ab]' : ''
          }`}>
          <Text
            className={`font-jetbrains text-sm font-bold ${
              activeTab === 'unscanned' ? 'text-[#ff80ab]' : textSecondaryClass
            }`}>
            UNSCANNED ({unscannedBoxes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleTabChange('scanned')}
          className={`flex-1 items-center justify-center py-4 ${
            activeTab === 'scanned' ? 'border-b-2 border-[#ff80ab]' : ''
          }`}>
          <Text
            className={`font-jetbrains text-sm font-bold ${
              activeTab === 'scanned' ? 'text-[#ff80ab]' : textSecondaryClass
            }`}>
            SCANNED ({scannedBoxes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Area */}
      {isTabLoading ? (
        <View className={`flex-1 items-center justify-center gap-3 py-16 ${bgClass}`}>
          <ActivityIndicator size="small" color="#ff80ab" />
          <Text className={`font-jetbrains text-xs font-semibold ${textSecondaryClass}`}>
            Loading {activeTab} boxes...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayBoxes}
          keyExtractor={(item, index) => `${item.cid}_${item.trf || ''}_${index}`}
          className={`flex-1 px-4 py-4 ${bgClass}`}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Text className={`font-hanken text-sm ${textSecondaryClass}`}>
                {activeTab === 'unscanned' ? 'All boxes scanned!' : 'No boxes scanned yet.'}
              </Text>
            </View>
          }
          renderItem={({ item: box }) => (
            <TouchableOpacity
              onPress={() => activeTab === 'unscanned' && setConfirmCidModal(box)}
              activeOpacity={activeTab === 'unscanned' ? 0.6 : 1}
              className={`mb-3 flex-row items-center justify-between rounded-lg border p-4 ${
                activeTab === 'scanned' ? 'border-[#22c55e]/40 bg-[#22c55e]/5' : cardBgClass
              }`}>
              <View className="flex-1 pr-2">
                <Text className="font-jetbrains text-sm font-semibold text-[#ff80ab]">
                  CID NO. : {box.cid}
                </Text>
                {box.trf ? (
                  <Text className={`mt-1 font-jetbrains text-xs ${textSecondaryClass}`}>
                    TRF NO. : <Text className={`font-semibold ${textPrimaryClass}`}>{box.trf}</Text>
                  </Text>
                ) : null}
              </View>
              {activeTab === 'scanned' && <CheckCircle color="#22c55e" size={18} />}
              {activeTab === 'unscanned' && (
                <View className="rounded border border-[#ff80ab]/30 bg-[#ff80ab]/10 px-2 py-0.5">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#ff80ab]">SCAN</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Progress Footer */}
      <View className={`border-t px-4 py-4 pb-6 ${footerBgClass}`}>
        <View className="mb-2 flex-row items-end justify-between">
          <View className="flex-row items-baseline gap-2">
            <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
              TOTAL PROGRESS
            </Text>
            <Text className="font-jetbrains text-sm font-bold text-[#ff80ab]">{progressPct}%</Text>
          </View>
          <Text className={`font-hanken text-sm ${textSecondaryClass}`}>
            <Text className={`font-bold ${textPrimaryClass}`}>
              {scannedBoxes.length}/{totalBoxes}
            </Text>{' '}
            Boxes
          </Text>
        </View>
        <View
          className={`h-1 w-full overflow-hidden rounded-full ${isDark ? 'bg-[#2a2a2d]' : 'bg-[#e4e4e7]'}`}>
          <View className="h-full rounded-full bg-[#ff80ab]" style={{ width: `${progressPct}%` }} />
        </View>
      </View>
    </SafeAreaView>
  );
}
