import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Keyboard, CheckCircle, X, AlertTriangle, Scan } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MANIFEST_CIDS_KEY, SCANNED_CIDS_KEY } from './one';

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

export default function ScanningBoxScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'unscanned' | 'scanned'>('unscanned');
  const [unscannedBoxes, setUnscannedBoxes] = useState<string[]>([]);
  const [scannedBoxes, setScannedBoxes] = useState<string[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');

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
  const unscannedRef = useRef<string[]>([]);
  const scannedRef = useRef<string[]>([]);
  const masterCidsRef = useRef<string[]>([]);

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

  // Animated laser sweep
  const [laserAnim] = useState(() => new Animated.Value(0));
  useFocusEffect(
    useCallback(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
      return () => laserAnim.stopAnimation();
    }, [laserAnim])
  );

  /** Deduplicate CIDs (case-insensitive) so duplicate rows are merged into one */
  const deduplicateCids = (cids: string[]): string[] => {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const c of cids) {
      const trimmed = c.trim();
      const upper = trimmed.toUpperCase();
      if (trimmed && !seen.has(upper)) {
        seen.add(upper);
        unique.push(trimmed);
      }
    }
    return unique;
  };

  // Reload manifest and saved scanned CIDs from AsyncStorage every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadSavedProgress = async () => {
        try {
          const storedManifest = await AsyncStorage.getItem(MANIFEST_CIDS_KEY);
          const storedScanned = await AsyncStorage.getItem(SCANNED_CIDS_KEY);

          if (storedManifest) {
            const allCids = JSON.parse(storedManifest) as string[];
            const uniqueCids = deduplicateCids(allCids);
            masterCidsRef.current = uniqueCids;

            const scannedCids = storedScanned
              ? deduplicateCids(JSON.parse(storedScanned) as string[])
              : [];
            setScannedBoxes(scannedCids);

            const scannedSet = new Set(scannedCids.map((s) => s.toUpperCase()));
            const remainingUnscanned = uniqueCids.filter((c) => !scannedSet.has(c.toUpperCase()));
            setUnscannedBoxes(remainingUnscanned);
          }
        } catch {
          // Storage read failed — leave list as-is
        }
      };
      loadSavedProgress();
    }, [])
  );

  const totalBoxes = unscannedBoxes.length + scannedBoxes.length;
  const progressPct = totalBoxes > 0 ? Math.round((scannedBoxes.length / totalBoxes) * 100) : 0;

  /** Secure, exact case-insensitive CID matcher (prevents partial prefix false matches) */
  const findMatchingCid = (input: string, list: string[]): string | null => {
    const raw = input.trim();
    if (!raw) return null;
    const cleanUpper = raw.toUpperCase();

    // 1. Exact match
    const exact = list.find((c) => c.trim() === raw);
    if (exact) return exact;

    // 2. Case-insensitive exact match
    const caseInsensitive = list.find((c) => c.trim().toUpperCase() === cleanUpper);
    if (caseInsensitive) return caseInsensitive;

    // 3. URL query parameter or prefixed string exact token extraction (e.g. "CID:112PK0000" or "?cid=112PK0000")
    if (raw.includes(':') || raw.includes('=') || raw.includes('/')) {
      const tokens = raw.split(/[:=/?#&]+/).map((t) => t.trim().toUpperCase());
      const tokenMatch = list.find((c) => tokens.includes(c.trim().toUpperCase()));
      if (tokenMatch) return tokenMatch;
    }

    return null;
  };

  /** Move a CID from unscanned → scanned, or notify if already scanned / missing */
  const handleScan = useCallback(
    (cid: string) => {
      const raw = cid.trim();
      if (!raw) return;

      const currentUnscanned = unscannedRef.current;
      const currentScanned = scannedRef.current;
      const masterCids = masterCidsRef.current;

      // 1. Check unscanned list (First time scan)
      const unscannedMatch = findMatchingCid(raw, currentUnscanned);
      if (unscannedMatch) {
        setUnscannedBoxes((prev) => prev.filter((c) => c !== unscannedMatch));
        setScannedBoxes((prev) => {
          const updated = prev.includes(unscannedMatch) ? prev : [unscannedMatch, ...prev];
          AsyncStorage.setItem(SCANNED_CIDS_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        setLastScanned(unscannedMatch);
        showNotification(
          'success',
          '✓ SCANNED SUCCESSFULLY',
          `Box CID ${unscannedMatch} moved to Scanned`
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
          `Box CID "${scannedMatch}" has ALREADY been scanned!`
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
    }
  };

  const displayBoxes = activeTab === 'unscanned' ? unscannedBoxes : scannedBoxes;

  return (
    <SafeAreaView className="flex-1 bg-[#131316]">
      {/* Manual Entry Modal */}
      <Modal visible={showManual} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="w-full rounded-xl border border-[#3f3f46] bg-[#1f1f22] p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-hanken text-base font-bold text-[#fafafa]">Manual Entry</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowManual(false);
                  setManualInput('');
                }}>
                <X color="#a1a1aa" size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Enter CID NO..."
              placeholderTextColor="#71717a"
              autoFocus
              autoCapitalize="characters"
              className="mb-4 h-11 rounded-lg border border-[#3f3f46] bg-[#131316] px-3 font-jetbrains text-sm text-[#fafafa]"
            />
            <TouchableOpacity
              onPress={submitManual}
              className="items-center justify-center rounded-lg bg-[#ff80ab] py-3">
              <Text className="font-jetbrains text-sm font-bold text-[#131316]">CONFIRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color="#fafafa" size={22} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-hanken text-xl font-bold text-[#fafafa]">Scanning</Text>
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
          className={`absolute left-4 right-4 top-20 flex-row items-center gap-3 rounded-xl border p-3.5 shadow-2xl ${
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

      {/* Camera Area */}
      <View className="relative h-[40%] overflow-hidden bg-black">
        {!permission ? (
          // Permissions loading
          <View className="flex-1 items-center justify-center gap-2">
            <ActivityIndicator size="small" color="#ff80ab" />
            <Text className="font-hanken text-sm text-[#a1a1aa]">Loading camera...</Text>
          </View>
        ) : !permission.granted ? (
          // Permission denied UI
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <AlertTriangle color="#eab308" size={36} />
            <Text className="text-center font-hanken text-sm text-[#a1a1aa]">
              Camera access is required to scan barcodes.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              className="rounded-lg bg-[#ff80ab] px-5 py-2.5">
              <Text className="font-jetbrains text-xs font-bold text-[#131316]">GRANT ACCESS</Text>
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
                className="flex-row items-center gap-1.5 rounded-xl border border-[#3f3f46] bg-[#2a2a2d]/90 px-3.5 py-3">
                <Keyboard color="#a1a1aa" size={16} />
                <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">MANUAL</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-[#3f3f46] bg-[#1f1f22]">
        <TouchableOpacity
          onPress={() => setActiveTab('unscanned')}
          className={`flex-1 items-center justify-center py-4 ${
            activeTab === 'unscanned' ? 'border-b-2 border-[#ff80ab]' : ''
          }`}>
          <Text
            className={`font-jetbrains text-sm font-bold ${
              activeTab === 'unscanned' ? 'text-[#ff80ab]' : 'text-[#a1a1aa]'
            }`}>
            UNSCANNED ({unscannedBoxes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('scanned')}
          className={`flex-1 items-center justify-center py-4 ${
            activeTab === 'scanned' ? 'border-b-2 border-[#ff80ab]' : ''
          }`}>
          <Text
            className={`font-jetbrains text-sm font-bold ${
              activeTab === 'scanned' ? 'text-[#ff80ab]' : 'text-[#a1a1aa]'
            }`}>
            SCANNED ({scannedBoxes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Area */}
      <ScrollView className="flex-1 bg-[#131316] px-4 py-4" showsVerticalScrollIndicator={false}>
        {displayBoxes.length === 0 ? (
          <View className="flex-1 items-center justify-center py-16">
            <Text className="font-hanken text-sm text-[#a1a1aa]">
              {activeTab === 'unscanned' ? 'All boxes scanned!' : 'No boxes scanned yet.'}
            </Text>
          </View>
        ) : (
          displayBoxes.map((cid, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => activeTab === 'unscanned' && handleScan(cid)}
              activeOpacity={activeTab === 'unscanned' ? 0.6 : 1}
              className={`mb-3 flex-row items-center justify-between rounded-lg border p-4 ${
                activeTab === 'scanned'
                  ? 'border-[#22c55e]/40 bg-[#22c55e]/5'
                  : 'border-[#3f3f46] bg-[#1f1f22]'
              }`}>
              <Text className="font-jetbrains text-sm font-semibold text-[#ffb2c3]">
                CID NO. : {cid}
              </Text>
              {activeTab === 'scanned' && <CheckCircle color="#22c55e" size={18} />}
              {activeTab === 'unscanned' && (
                <View className="rounded border border-[#ff80ab]/30 bg-[#ff80ab]/10 px-2 py-0.5">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#ff80ab]">SCAN</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Progress Footer */}
      <View className="border-t border-[#3f3f46] bg-[#131316] px-4 py-4 pb-6">
        <View className="mb-2 flex-row items-end justify-between">
          <View className="flex-row items-baseline gap-2">
            <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">TOTAL PROGRESS</Text>
            <Text className="font-jetbrains text-sm font-bold text-[#ff80ab]">{progressPct}%</Text>
          </View>
          <Text className="font-hanken text-sm text-[#a1a1aa]">
            <Text className="font-bold text-[#fafafa]">
              {scannedBoxes.length}/{totalBoxes}
            </Text>{' '}
            Boxes
          </Text>
        </View>
        <View className="h-1 w-full overflow-hidden rounded-full bg-[#2a2a2d]">
          <View className="h-full rounded-full bg-[#ff80ab]" style={{ width: `${progressPct}%` }} />
        </View>
      </View>
    </SafeAreaView>
  );
}
