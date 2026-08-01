import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Keyboard,
  CheckCircle,
  X,
  AlertTriangle,
  Scan,
  Plus,
  Minus,
  Package,
  Box as BoxIcon,
  Lock,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MANIFEST_ITEMS_KEY, SCANNED_ITEMS_KEY, type ItemManifestRecord } from '../utils/storage';

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

export default function ScanningItemScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'unscanned' | 'scanned'>('unscanned');
  const [items, setItems] = useState<ItemManifestRecord[]>([]);
  const [scannedMap, setScannedMap] = useState<Record<string, number>>({});
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // CID Filter state & ref
  const [selectedCidFilter, setSelectedCidFilter] = useState<string | null>(null);
  const selectedCidRef = useRef<string | null>(null);
  const [showCidModal, setShowCidModal] = useState(false);
  const [cidInputText, setCidInputText] = useState('');

  useEffect(() => {
    selectedCidRef.current = selectedCidFilter;
  }, [selectedCidFilter]);

  // Scanned item QTY input modal state
  const [scannedItemModal, setScannedItemModal] = useState<ItemManifestRecord | null>(null);
  const [qtyInputModalValue, setQtyInputModalValue] = useState<string>('1');

  // Full screen tabs mode (covers camera when swiped up)
  const [isFullScreenTabs, setIsFullScreenTabs] = useState(false);

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
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Live refs to avoid stale closure issues during fast camera scanning
  const itemsRef = useRef<ItemManifestRecord[]>([]);
  const scannedMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    scannedMapRef.current = scannedMap;
  }, [scannedMap]);

  // Automatically request camera permission if not granted
  useEffect(() => {
    if (!permission || (!permission.granted && permission.canAskAgain)) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounce: prevent the same barcode from firing twice in quick succession
  const scanCooldown = useRef(false);

  // Animated laser sweep
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

  // Reload item manifest and saved progress from AsyncStorage
  useFocusEffect(
    useCallback(() => {
      const loadSavedProgress = async () => {
        try {
          const storedManifest = await AsyncStorage.getItem(MANIFEST_ITEMS_KEY);
          const storedScanned = await AsyncStorage.getItem(SCANNED_ITEMS_KEY);

          if (storedManifest) {
            const parsedItems = JSON.parse(storedManifest) as ItemManifestRecord[];
            setItems(parsedItems);

            const parsedScanned = storedScanned
              ? (JSON.parse(storedScanned) as Record<string, number>)
              : {};
            setScannedMap(parsedScanned);
          }
        } catch {
          // Storage read failed — leave list as-is
        }
      };
      loadSavedProgress();
    }, [])
  );

  /** Secure case-insensitive item matcher by UPC, SKU, CID NO, or TRF NO */
  const findMatchingItem = (
    input: string,
    list: ItemManifestRecord[]
  ): ItemManifestRecord | null => {
    let raw = input.trim();
    if (!raw) return null;

    // Remove 3 leading zeros if present (e.g. "000309179" -> "309179")
    if (raw.startsWith('000')) {
      raw = raw.slice(3);
    }
    const cleanUpper = raw.toUpperCase();

    // 1. Match by UPC (Exact / Case-insensitive, or stripped 3 leading zeros)
    const matchByUpc = list.find((i) => {
      const u = i.upc.trim().toUpperCase();
      return u === cleanUpper || (u.startsWith('000') && u.slice(3) === cleanUpper);
    });
    if (matchByUpc) return matchByUpc;

    // 2. Match by SKU (Exact / Case-insensitive, or stripped 3 leading zeros)
    const matchBySku = list.find((i) => {
      const s = i.sku.trim().toUpperCase();
      return s === cleanUpper || (s.startsWith('000') && s.slice(3) === cleanUpper);
    });
    if (matchBySku) return matchBySku;

    // 3. Match by CID NO
    const matchByCid = list.find((i) => {
      const c = i.cid.trim().toUpperCase();
      return c === cleanUpper || (c.startsWith('000') && c.slice(3) === cleanUpper);
    });
    if (matchByCid) return matchByCid;

    // 4. Match by TRF NO
    const matchByTrf = list.find((i) => {
      const t = i.trf.trim().toUpperCase();
      return t === cleanUpper || (t.startsWith('000') && t.slice(3) === cleanUpper);
    });
    if (matchByTrf) return matchByTrf;

    // 5. Token extraction match for formatted barcodes (e.g. "SKU:123" or "UPC=456")
    if (raw.includes(':') || raw.includes('=') || raw.includes('/')) {
      const tokens = raw.split(/[:=/?#&]+/).map((t) => {
        let tok = t.trim().toUpperCase();
        if (tok.startsWith('000')) tok = tok.slice(3);
        return tok;
      });
      const tokenMatch = list.find((i) => {
        const u = i.upc.trim().toUpperCase();
        const s = i.sku.trim().toUpperCase();
        const c = i.cid.trim().toUpperCase();
        const t = i.trf.trim().toUpperCase();
        const uClean = u.startsWith('000') ? u.slice(3) : u;
        const sClean = s.startsWith('000') ? s.slice(3) : s;
        const cClean = c.startsWith('000') ? c.slice(3) : c;
        const tClean = t.startsWith('000') ? t.slice(3) : t;

        return (
          tokens.includes(u) ||
          tokens.includes(uClean) ||
          tokens.includes(s) ||
          tokens.includes(sClean) ||
          tokens.includes(c) ||
          tokens.includes(cClean) ||
          tokens.includes(t) ||
          tokens.includes(tClean)
        );
      });
      if (tokenMatch) return tokenMatch;
    }

    return null;
  };

  /** Process scanned barcode or manual input */
  const handleScan = useCallback(
    (scannedCode: string) => {
      let raw = scannedCode.trim();
      if (!raw) return;

      // Remove 3 leading zeros if present (e.g. "000309179" -> "309179")
      if (raw.startsWith('000')) {
        raw = raw.slice(3);
      }
      if (!raw) return;

      const currentItems = itemsRef.current;
      const cleanUpper = raw.toUpperCase();

      // 1. Check if scanned string matches a Box CID barcode directly
      const matchedCidRecord = currentItems.find(
        (i) =>
          i.cid.trim().toUpperCase() === cleanUpper ||
          (i.cid.trim().toUpperCase().startsWith('000') &&
            i.cid.trim().toUpperCase().slice(3) === cleanUpper)
      );

      if (matchedCidRecord && !findMatchingItem(raw, currentItems)) {
        const targetCid = matchedCidRecord.cid;
        setSelectedCidFilter(targetCid);
        showNotification(
          'success',
          '🔒 CID FILTER LOCKED',
          `Filter locked to CID "${targetCid}". Only items in this CID can be scanned.`
        );
        playScanFeedback('success');
        return;
      }

      // 2. Find matching item record in manifest
      const matchedItem = findMatchingItem(raw, currentItems);

      if (matchedItem) {
        const activeCid = selectedCidRef.current;

        // Enforce strict CID restriction if filter is active
        if (activeCid && matchedItem.cid.trim().toUpperCase() !== activeCid.trim().toUpperCase()) {
          showNotification(
            'error',
            '❌ CID MISMATCH RESTRICTION',
            `Item ${matchedItem.sku || matchedItem.upc} belongs to CID "${matchedItem.cid}", but filter is locked to CID "${activeCid}"!`
          );
          playScanFeedback('error');
          return;
        }

        // CID matches active filter (or filter is clear) -> open QTY input modal
        const currentQty = scannedMapRef.current[matchedItem.id] || 0;
        setScannedItemModal(matchedItem);
        setQtyInputModalValue(String(currentQty > 0 ? currentQty : matchedItem.qty));
        playScanFeedback('success');
        return;
      }

      // 3. Not found in item manifest
      showNotification(
        'error',
        '❌ NOT IN MANIFEST',
        `Scanned code "${raw}" was not found in item manifest data`
      );
      playScanFeedback('error');
    },
    [showNotification]
  );

  /** Camera barcode detected */
  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
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

  // Extract unique CIDs from items manifest
  const availableCids = Array.from(new Set(items.map((i) => i.cid.trim()).filter(Boolean)));

  // Filter items by active CID filter
  const filteredByCid = selectedCidFilter
    ? items.filter((i) => i.cid.trim().toUpperCase() === selectedCidFilter.trim().toUpperCase())
    : items;

  // Filter items for tabs
  const unscannedList = filteredByCid.filter((i) => (scannedMap[i.id] || 0) === 0);
  const scannedList = filteredByCid.filter((i) => (scannedMap[i.id] || 0) > 0);

  const displayItems = activeTab === 'unscanned' ? unscannedList : scannedList;

  // Calculate overall quantity progress for active CID filter
  const totalExpectedQty = filteredByCid.reduce((sum, i) => sum + (i.qty || 1), 0);
  const totalScannedQty = filteredByCid.reduce((sum, i) => sum + (scannedMap[i.id] || 0), 0);
  const progressPct =
    totalExpectedQty > 0
      ? Math.min(100, Math.round((totalScannedQty / totalExpectedQty) * 100))
      : 0;

  return (
    <SafeAreaView className="flex-1 bg-[#131316]">
      {/* Manual Entry Modal */}
      <Modal visible={showManual} transparent animationType="fade">
        <View className=" flex-1 items-center justify-center bg-black/70 px-6">
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
              placeholder="Enter UPC, SKU, CID, or TRF..."
              placeholderTextColor="#71717a"
              autoFocus
              autoCapitalize="characters"
              className="mb-4 h-11 rounded-lg border border-[#3f3f46] bg-[#131316] px-3 font-jetbrains text-sm text-[#fafafa]"
            />
            <TouchableOpacity
              onPress={submitManual}
              className="items-center justify-center rounded-lg bg-[#e5005c] py-3">
              <Text className="font-jetbrains text-sm font-bold text-[#ffffff]">CONFIRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CID Filter Selection Modal */}
      <Modal visible={showCidModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="max-h-[80%] w-full rounded-xl border border-[#3f3f46] bg-[#1f1f22] p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <BoxIcon color="#e5005c" size={20} />
                <Text className="font-hanken text-base font-bold text-[#fafafa]">
                  Filter Items by Box CID
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCidModal(false)}>
                <X color="#a1a1aa" size={20} />
              </TouchableOpacity>
            </View>

            <Text className="mb-3 font-hanken text-xs text-[#a1a1aa]">
              Type or select a Box CID. Scanning will be restricted exclusively to items under the
              selected CID.
            </Text>

            {/* Manual CID Input */}
            <View className="mb-3 flex-row items-center gap-2">
              <TextInput
                value={cidInputText}
                onChangeText={setCidInputText}
                placeholder="Enter CID NO..."
                placeholderTextColor="#71717a"
                autoCapitalize="characters"
                className="h-11 flex-1 rounded-lg border border-[#3f3f46] bg-[#131316] px-3 font-jetbrains text-sm text-[#fafafa]"
              />
              <TouchableOpacity
                onPress={() => {
                  if (cidInputText.trim()) {
                    const clean = cidInputText.trim();
                    setSelectedCidFilter(clean);
                    setCidInputText('');
                    setShowCidModal(false);
                    showNotification(
                      'success',
                      '🔒 CID FILTER APPLIED',
                      `Filter locked to CID: ${clean}`
                    );
                  }
                }}
                className="h-11 items-center justify-center rounded-lg bg-[#e5005c] px-4">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">APPLY</Text>
              </TouchableOpacity>
            </View>

            {/* All CIDs option */}
            <TouchableOpacity
              onPress={() => {
                setSelectedCidFilter(null);
                setShowCidModal(false);
                showNotification('info', 'UNFILTERED MODE', 'Showing items from all CIDs');
              }}
              className={`mb-3 flex-row items-center justify-between rounded-lg border p-3 ${
                selectedCidFilter === null
                  ? 'border-[#e5005c] bg-[#e5005c]/10'
                  : 'border-[#3f3f46] bg-[#131316]'
              }`}>
              <Text className="font-jetbrains text-xs font-bold text-[#fafafa]">
                ALL CIDS (Show All Items)
              </Text>
              {selectedCidFilter === null && <CheckCircle color="#e5005c" size={16} />}
            </TouchableOpacity>

            <Text className="mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              Available CIDs from Manifest ({availableCids.length})
            </Text>

            {/* Available CIDs List */}
            <FlatList
              data={availableCids}
              keyExtractor={(cid) => cid}
              className=" max-h-52"
              renderItem={({ item: cid }) => {
                const isSelected =
                  selectedCidFilter?.trim().toUpperCase() === cid.trim().toUpperCase();
                const cidItemCount = items.filter(
                  (i) => i.cid.trim().toUpperCase() === cid.trim().toUpperCase()
                ).length;

                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCidFilter(cid);
                      setShowCidModal(false);
                      showNotification('success', '🔒 CID LOCKED', `Filter locked to CID: ${cid}`);
                    }}
                    className={`mb-2 flex-row items-center justify-between rounded-lg border p-3 ${
                      isSelected
                        ? 'border-[#e5005c] bg-[#e5005c]/15'
                        : 'border-[#3f3f46] bg-[#131316]'
                    }`}>
                    <View className="flex-row items-center gap-2">
                      <BoxIcon color={isSelected ? '#e5005c' : '#a1a1aa'} size={16} />
                      <Text className="font-jetbrains text-xs font-semibold text-[#fafafa]">
                        CID: {cid}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="rounded bg-[#2a2a2d] px-2 py-0.5">
                        <Text className="font-jetbrains text-[10px] text-[#a1a1aa]">
                          {cidItemCount} items
                        </Text>
                      </View>
                      {isSelected && <CheckCircle color="#e5005c" size={16} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Scanned Item QTY Input Modal */}
      <Modal visible={scannedItemModal !== null} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="w-full rounded-xl border border-[#3f3f46] bg-[#1f1f22] p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-hanken text-base font-bold text-[#fafafa]">
                Item Barcode Scanned
              </Text>
              <TouchableOpacity onPress={() => setScannedItemModal(null)}>
                <X color="#a1a1aa" size={20} />
              </TouchableOpacity>
            </View>

            {scannedItemModal && (
              <>
                <Text className="mb-3 font-hanken text-xs text-[#a1a1aa]">
                  Verify or input the QTY of the item scanned to record to the Scanned tab:
                </Text>

                <View className="mb-4 gap-1.5 rounded-lg border border-[#e5005c]/30 bg-[#e5005c]/10 p-3.5">
                  {scannedItemModal.sku ? (
                    <Text className="font-jetbrains text-xs font-bold text-[#fafafa]">
                      SKU: {scannedItemModal.sku}
                    </Text>
                  ) : null}
                  {scannedItemModal.upc ? (
                    <Text className="font-jetbrains text-xs text-[#e5005c]">
                      UPC: {scannedItemModal.upc}
                    </Text>
                  ) : null}
                  {scannedItemModal.cid ? (
                    <Text className="font-jetbrains text-[11px] text-[#a1a1aa]">
                      CID: {scannedItemModal.cid} | TRF: {scannedItemModal.trf}
                    </Text>
                  ) : null}
                  {scannedItemModal.description ? (
                    <Text className="font-hanken text-xs text-[#a1a1aa]" numberOfLines={2}>
                      {scannedItemModal.description}
                    </Text>
                  ) : null}
                  <View className="mt-1 flex-row items-center justify-between border-t border-[#e5005c]/20 pt-2">
                    <Text className="font-jetbrains text-xs text-[#a1a1aa]">MANIFEST QTY:</Text>
                    <Text className="font-jetbrains text-xs font-bold text-[#22c55e]">
                      {scannedItemModal.qty}
                    </Text>
                  </View>
                </View>

                <Text className="mb-1.5 font-jetbrains text-xs font-semibold text-[#fafafa]">
                  INPUT SCANNED QTY:
                </Text>
                <View className="mb-4 flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      const current = parseInt(qtyInputModalValue, 10) || 1;
                      setQtyInputModalValue(String(Math.max(1, current - 1)));
                    }}
                    className="h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]">
                    <Minus color="#fafafa" size={18} />
                  </TouchableOpacity>

                  <TextInput
                    value={qtyInputModalValue}
                    onChangeText={setQtyInputModalValue}
                    keyboardType="number-pad"
                    className="h-11 flex-1 rounded-lg border border-[#3f3f46] bg-[#131316] text-center font-jetbrains text-base font-bold text-[#fafafa]"
                  />

                  <TouchableOpacity
                    onPress={() => {
                      const current = parseInt(qtyInputModalValue, 10) || 0;
                      setQtyInputModalValue(String(current + 1));
                    }}
                    className="h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]">
                    <Plus color="#fafafa" size={18} />
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setScannedItemModal(null)}
                    className="flex-1 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d] py-3">
                    <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">CANCEL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const item = scannedItemModal;
                      const enteredQty = parseInt(qtyInputModalValue, 10);
                      if (isNaN(enteredQty) || enteredQty <= 0) {
                        showNotification('error', 'INVALID QTY', 'Please enter a valid number');
                        return;
                      }

                      setScannedItemModal(null);

                      // Save updated QTY to scannedMap
                      const updatedMap = { ...scannedMapRef.current, [item.id]: enteredQty };
                      setScannedMap(updatedMap);
                      AsyncStorage.setItem(SCANNED_ITEMS_KEY, JSON.stringify(updatedMap)).catch(
                        () => {}
                      );

                      const itemLabel = item.sku || item.upc || item.description || 'Item';
                      setLastScanned(itemLabel);
                      setActiveTab('scanned');

                      showNotification(
                        'success',
                        '✓ ADDED TO SCANNED',
                        `${itemLabel} recorded in Scanned tab with QTY: ${enteredQty}`
                      );
                      playScanFeedback('success');
                    }}
                    className="flex-1 items-center justify-center rounded-lg bg-[#e5005c] py-3">
                    <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                      SAVE TO SCANNED
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color="#fafafa" size={22} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-hanken text-xl font-bold text-[#fafafa]">Item Scanning</Text>
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

      {/* Active Box CID Filter Bar */}
      <View className="flex-row items-center justify-between border-b border-[#3f3f46] bg-[#1f1f22] px-4 py-2.5">
        <View className="flex-1 flex-row items-center gap-2">
          {selectedCidFilter ? (
            <Lock color="#e5005c" size={16} />
          ) : (
            <BoxIcon color="#71717a" size={16} />
          )}
          <View className="flex-1">
            <Text className="font-jetbrains text-[9px] font-bold tracking-wider text-[#a1a1aa]">
              {selectedCidFilter ? 'BOX CID FILTER (LOCKED)' : 'BOX CID FILTER'}
            </Text>
            <Text className="font-jetbrains text-xs font-bold text-[#fafafa]" numberOfLines={1}>
              {selectedCidFilter ? `CID NO: ${selectedCidFilter}` : 'ALL CIDS (UNFILTERED)'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setShowCidModal(true)}
            className={`rounded-lg border px-3 py-1.5 ${
              selectedCidFilter
                ? 'border-[#e5005c] bg-[#e5005c]/10'
                : 'border-[#3f3f46] bg-[#2a2a2d]'
            }`}>
            <Text
              className={`font-jetbrains text-xs font-bold ${
                selectedCidFilter ? 'text-[#e5005c]' : 'text-[#fafafa]'
              }`}>
              {selectedCidFilter ? 'CHANGE CID' : 'FILTER CID'}
            </Text>
          </TouchableOpacity>

          {selectedCidFilter && (
            <TouchableOpacity
              onPress={() => {
                setSelectedCidFilter(null);
                showNotification('info', 'CID UNLOCKED', 'Showing items from all CIDs');
              }}
              className="rounded-lg border border-[#3f3f46] bg-[#2a2a2d] px-2.5 py-1.5">
              <Text className="font-jetbrains text-xs font-semibold text-[#a1a1aa]">CLEAR</Text>
            </TouchableOpacity>
          )}
        </View>
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
            <View className="flex-1 items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#e5005c" />
              <Text className="font-hanken text-sm text-[#a1a1aa]">Loading camera...</Text>
            </View>
          ) : !permission.granted ? (
            <View className="flex-1 items-center justify-center gap-3 px-6">
              <AlertTriangle color="#eab308" size={36} />
              <Text className="text-center font-hanken text-sm text-[#a1a1aa]">
                Camera access is required to scan barcodes.
              </Text>
              <TouchableOpacity
                onPress={requestPermission}
                className="rounded-lg bg-[#e5005c] px-5 py-2.5">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                  GRANT ACCESS
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
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

          {/* Overlays */}
          {permission?.granted && (
            <>
              {/* Scanning Brackets */}
              <View
                className={`absolute left-8 top-10 h-12 w-12 border-l-[3px] border-t-[3px] ${
                  isHoldScanning ? 'border-[#e5005c]' : 'border-[#52525b]'
                }`}
              />
              <View
                className={`absolute right-8 top-10 h-12 w-12 border-r-[3px] border-t-[3px] ${
                  isHoldScanning ? 'border-[#e5005c]' : 'border-[#52525b]'
                }`}
              />
              <View
                className={`absolute bottom-16 left-8 h-12 w-12 border-b-[3px] border-l-[3px] ${
                  isHoldScanning ? 'border-[#e5005c]' : 'border-[#52525b]'
                }`}
              />
              <View
                className={`absolute bottom-16 right-8 h-12 w-12 border-b-[3px] border-r-[3px] ${
                  isHoldScanning ? 'border-[#e5005c]' : 'border-[#52525b]'
                }`}
              />

              {/* Status Badge */}
              <View className="absolute left-0 right-0 top-3 items-center justify-center">
                <View
                  className={`flex-row items-center gap-2 rounded-full border px-3.5 py-1 shadow-md ${
                    isHoldScanning
                      ? 'border-[#e5005c] bg-[#e5005c]/20'
                      : 'border-[#3f3f46] bg-black/60'
                  }`}>
                  <View
                    className={`h-2 w-2 rounded-full ${
                      isHoldScanning ? 'bg-[#e5005c]' : 'bg-[#71717a]'
                    }`}
                  />
                  <Text
                    className={`font-jetbrains text-[11px] font-bold ${
                      isHoldScanning ? 'text-[#e5005c]' : 'text-[#a1a1aa]'
                    }`}>
                    {isHoldScanning ? 'SCANNER ACTIVE' : 'HOLD BUTTON TO SCAN'}
                  </Text>
                </View>
              </View>

              {/* Animated Laser Line */}
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

              {/* Bottom Controls */}
              <View className="absolute bottom-3 left-4 right-4 flex-row items-center gap-2.5">
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
                      ? 'border-[#e5005c] bg-[#e5005c]'
                      : 'border-[#e5005c]/50 bg-[#e5005c]/10'
                  }`}>
                  <Scan color={isHoldScanning ? '#ffffff' : '#e5005c'} size={18} />
                  <Text
                    className={`font-jetbrains text-xs font-extrabold tracking-wider ${
                      isHoldScanning ? 'text-[#ffffff]' : 'text-[#e5005c]'
                    }`}>
                    {isHoldScanning ? 'SCANNING...' : 'HOLD TO SCAN'}
                  </Text>
                </TouchableOpacity>

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
      )}

      {/* Swipe Up/Down Handle Bar */}
      <TouchableOpacity
        {...panResponder.panHandlers}
        onPress={() => setIsFullScreenTabs((prev) => !prev)}
        activeOpacity={0.8}
        className="flex-row items-center justify-center gap-1.5 border-b border-[#3f3f46]/60 bg-[#18181b] py-2">
        <View className="h-1.5 w-10 rounded-full bg-[#3f3f46]" />
        {isFullScreenTabs ? (
          <View className="flex-row items-center gap-1">
            <ChevronDown color="#e5005c" size={14} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
              SWIPE DOWN / TAP TO SHOW CAMERA
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <ChevronUp color="#a1a1aa" size={14} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#a1a1aa]">
              SWIPE UP FOR FULL SCREEN TABS
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Tabs */}
      <View className="flex-row border-b border-[#3f3f46] bg-[#1f1f22]">
        <TouchableOpacity
          onPress={() => handleTabChange('unscanned')}
          className={`flex-1 items-center justify-center py-4 ${
            activeTab === 'unscanned' ? 'border-b-2 border-[#e5005c]' : ''
          }`}>
          <Text
            className={`font-jetbrains text-sm font-bold ${
              activeTab === 'unscanned' ? 'text-[#e5005c]' : 'text-[#a1a1aa]'
            }`}>
            UNSCANNED ({unscannedList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleTabChange('scanned')}
          className={`flex-1 items-center justify-center py-4 ${
            activeTab === 'scanned' ? 'border-b-2 border-[#e5005c]' : ''
          }`}>
          <Text
            className={`font-jetbrains text-sm font-bold ${
              activeTab === 'scanned' ? 'text-[#e5005c]' : 'text-[#a1a1aa]'
            }`}>
            SCANNED ({scannedList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Area */}
      {isTabLoading ? (
        <View className="flex-1 items-center justify-center gap-3 bg-[#131316] py-16">
          <ActivityIndicator size="small" color="#e5005c" />
          <Text className="font-jetbrains text-xs font-semibold text-[#a1a1aa]">
            Loading {activeTab} items...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          className="flex-1 bg-[#131316] px-4 py-4"
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Package color="#71717a" size={32} className="mb-2" />
              <Text className="font-hanken text-sm text-[#a1a1aa]">
                {activeTab === 'unscanned'
                  ? selectedCidFilter
                    ? `All items under CID ${selectedCidFilter} fully scanned!`
                    : 'All items fully scanned!'
                  : 'No items scanned yet.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const currentQty = scannedMap[item.id] || 0;
            const isCompleted = currentQty >= item.qty;
            const isOverScanned = currentQty > item.qty;
            const overageAmount = currentQty - item.qty;
            const remainingQty = Math.max(0, item.qty - currentQty);

            return (
              <TouchableOpacity
                onPress={() => {
                  setScannedItemModal(item);
                  setQtyInputModalValue(String(currentQty > 0 ? currentQty : item.qty));
                }}
                activeOpacity={0.7}
                className={`mb-3 rounded-lg border p-4 ${
                  isOverScanned
                    ? 'border-[#ef4444]/60 bg-[#ef4444]/10'
                    : isCompleted
                      ? 'border-[#22c55e]/40 bg-[#22c55e]/5'
                      : currentQty > 0
                        ? 'border-[#e5005c]/40 bg-[#e5005c]/5'
                        : 'border-[#3f3f46] bg-[#1f1f22]'
                }`}>
                {/* Headers: CID & TRF */}
                <View className="mb-1.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    {item.cid ? (
                      <View className="rounded bg-[#2a2a2d] px-2 py-0.5">
                        <Text className="font-jetbrains text-[10px] text-[#a1a1aa]">
                          CID: {item.cid}
                        </Text>
                      </View>
                    ) : null}
                    {item.trf ? (
                      <View className="rounded bg-[#2a2a2d] px-2 py-0.5">
                        <Text className="font-jetbrains text-[10px] text-[#a1a1aa]">
                          TRF: {item.trf}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {isOverScanned ? (
                    <View className="flex-row items-center gap-1 rounded border border-[#ef4444]/40 bg-[#ef4444]/20 px-2 py-0.5">
                      <AlertTriangle color="#ef4444" size={12} />
                      <Text className="font-jetbrains text-[9px] font-extrabold text-[#ef4444]">
                        OVER-SCANNED (+{overageAmount})
                      </Text>
                    </View>
                  ) : isCompleted ? (
                    <View className="flex-row items-center gap-1 rounded bg-[#22c55e]/20 px-2 py-0.5">
                      <CheckCircle color="#22c55e" size={12} />
                      <Text className="font-jetbrains text-[9px] font-bold text-[#22c55e]">
                        FULFILLED
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Identifiers: SKU & UPC */}
                <View className="mb-1">
                  {item.sku ? (
                    <Text className="font-jetbrains text-sm font-bold text-[#fafafa]">
                      SKU: {item.sku}
                    </Text>
                  ) : null}
                  {item.upc ? (
                    <Text className="font-jetbrains text-xs text-[#a1a1aa]">UPC: {item.upc}</Text>
                  ) : null}
                </View>

                {/* Description */}
                {item.description ? (
                  <Text className="mb-3 font-hanken text-xs text-[#71717a]" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {/* QTY of the items & Remaining to Fulfill */}
                <View className="mt-1 flex-row flex-wrap items-center justify-between gap-2 border-t border-[#2a2a2d] pt-2.5">
                  <View className="flex-row items-center gap-1.5">
                    <View className="rounded bg-[#2a2a2d] px-2 py-0.5">
                      <Text className="font-jetbrains text-[9px] font-bold text-[#fafafa]">
                        MANIFEST QTY: {item.qty}
                      </Text>
                    </View>

                    {currentQty > 0 && (
                      <View
                        className={`rounded px-2 py-0.5 ${
                          isOverScanned ? 'bg-[#ef4444]/20' : 'bg-[#e5005c]/20'
                        }`}>
                        <Text
                          className={`font-jetbrains text-[9px] font-bold ${
                            isOverScanned ? 'text-[#ef4444]' : 'text-[#e5005c]'
                          }`}>
                          SCANNED QTY: {currentQty}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Status / Remaining / Overage Badge */}
                  {isOverScanned ? (
                    <View className="flex-row items-center gap-1 rounded border border-[#ef4444]/40 bg-[#ef4444]/20 px-2 py-0.5">
                      <AlertTriangle color="#ef4444" size={10} />
                      <Text className="font-jetbrains text-[9px] font-extrabold text-[#ef4444]">
                        EXCEEDED BY +{overageAmount}
                      </Text>
                    </View>
                  ) : remainingQty > 0 ? (
                    <View className="rounded border border-[#eab308]/30 bg-[#eab308]/10 px-2 py-0.5">
                      <Text className="font-jetbrains text-[9px] font-bold text-[#eab308]">
                        REMAINING: {remainingQty}
                      </Text>
                    </View>
                  ) : (
                    <View className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5">
                      <Text className="font-jetbrains text-[9px] font-bold text-[#22c55e]">
                        FULFILLED
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Progress Footer */}
      <View className="border-t border-[#3f3f46] bg-[#131316] px-4 py-4 pb-6">
        <View className="mb-2 flex-row items-end justify-between">
          <View className="flex-row items-baseline gap-2">
            <Text className="font-jetbrains text-xs font-bold text-[#a1a1aa]">
              {selectedCidFilter ? `PROGRESS (${selectedCidFilter})` : 'TOTAL ITEM PROGRESS'}
            </Text>
            <Text className="font-jetbrains text-sm font-bold text-[#e5005c]">{progressPct}%</Text>
          </View>
          <Text className="font-hanken text-sm text-[#a1a1aa]">
            <Text className="font-bold text-[#fafafa]">
              {totalScannedQty}/{totalExpectedQty}
            </Text>{' '}
            Qty
          </Text>
        </View>
        <View className="h-1 w-full overflow-hidden rounded-full bg-[#2a2a2d]">
          <View className="h-full rounded-full bg-[#e5005c]" style={{ width: `${progressPct}%` }} />
        </View>
      </View>
    </SafeAreaView>
  );
}
