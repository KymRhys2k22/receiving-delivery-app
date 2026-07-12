import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Scan,
  FileUp,
  AlertTriangle,
  User,
  Check,
  X,
  Package,
  Camera,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage key shared with scanningBox.tsx
export const MANIFEST_CIDS_KEY = 'manifest_cids';

interface Item {
  sku: string;
  desc: string;
  expected: number;
  scanned: number;
}

interface Box {
  id: string;
  status: 'pending' | 'verified' | 'discrepant';
  items: Item[];
}

const INITIAL_BOXES: Box[] = [
  {
    id: 'BOX-25-B',
    status: 'pending',
    items: [
      { sku: 'SKU-9902-A', desc: 'Industrial Sensor Hub', expected: 2, scanned: 0 },
      { sku: 'SKU-4810-F', desc: 'Cat6 Ethernet Shield', expected: 1, scanned: 0 },
    ],
  },
  {
    id: 'BOX-24-A',
    status: 'discrepant',
    items: [{ sku: 'SKU-1029-X', desc: 'Hydraulic Valve Adapter', expected: 3, scanned: 1 }],
  },
  {
    id: 'BOX-26-C',
    status: 'pending',
    items: [{ sku: 'SKU-8821-K', desc: 'High-Temp Thermocouple', expected: 5, scanned: 0 }],
  },
];

export default function TabOneScreen() {
  const navigation = useNavigation();
  const [currentMode, setCurrentMode] = useState<'dashboard' | 'scan_box' | 'verify_items'>(
    'dashboard'
  );

  // Track boxes
  const [boxes, setBoxes] = useState<Box[]>(INITIAL_BOXES);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Input fields
  const [manualBoxId, setManualBoxId] = useState('');
  const [manualItemId, setManualItemId] = useState('');

  // Toast / Status banner
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  // Upload manifest simulation
  const [isUploading, setIsUploading] = useState(false);

  // Animation for scanner laser line
  const [scannerAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (currentMode === 'scan_box') {
      const runAnimation = () => {
        scannerAnim.setValue(0);
        Animated.loop(
          Animated.sequence([
            Animated.timing(scannerAnim, {
              toValue: 1,
              duration: 1800,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(scannerAnim, {
              toValue: 0,
              duration: 1800,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      runAnimation();
    } else {
      scannerAnim.stopAnimation();
    }
  }, [currentMode, scannerAnim]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  /**
   * Step 1 — Upload Box Manifest CSV.
   * Parses with PapaParse, extracts the "CID NO" column,
   * and persists the list to AsyncStorage for scanningBox.tsx.
   */
  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const asset = result.assets[0];

        // Read raw CSV text — fetch() works with file://, content:// and any picker URI
        const csvText = await fetch(asset.uri).then((r) => r.text());

        // Parse with PapaParse — explicit comma delimiter avoids auto-detect issues
        const parsed = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
        });

        // Only abort on fatal errors (not the non-fatal "auto-detect" warning)
        const fatalErrors = parsed.errors.filter((e) => e.type !== 'Delimiter');
        if (fatalErrors.length > 0) {
          setIsUploading(false);
          showToast(`CSV parse error: ${fatalErrors[0].message}`, 'error');
          return;
        }

        // Extract the "CID NO" column (trim whitespace from header/value)
        const cidList: string[] = parsed.data
          .map((row) => {
            const key = Object.keys(row).find((k) => k.trim() === 'CID NO');
            return key ? row[key].trim() : '';
          })
          .filter(Boolean);

        if (cidList.length === 0) {
          setIsUploading(false);
          showToast('No "CID NO" column found in CSV', 'error');
          return;
        }

        // Persist to AsyncStorage
        await AsyncStorage.setItem(MANIFEST_CIDS_KEY, JSON.stringify(cidList));

        // Reset boxes to pending
        setBoxes(
          INITIAL_BOXES.map((b) => ({
            ...b,
            status: 'pending',
            items: b.items.map((i) => ({ ...i, scanned: 0 })),
          }))
        );

        setIsUploading(false);
        showToast(`Manifest uploaded: ${cidList.length} CIDs from ${asset.name}`, 'success');

        // Navigate to ScanningBox so the user can start scanning immediately
        navigation.navigate('ScanningBox' as never);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: unknown) {
      setIsUploading(false);
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[handleUpload]', msg);
      showToast(`Upload failed: ${msg}`, 'error');
    }
  };

  const handleUploadScanningData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        setTimeout(() => {
          setIsUploading(false);
          showToast(`Scanning data uploaded: ${result.assets[0].name}`, 'success');
        }, 1500);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: unknown) {
      showToast('Error picking document', 'error');
    }
  };

  const handleScanBox = (boxId: string) => {
    const cleanId = boxId.trim().toUpperCase();
    const box = boxes.find((b) => b.id.toUpperCase() === cleanId);

    if (!box) {
      showToast(`Unknown Box ID: ${cleanId}`, 'error');
      return;
    }

    setSelectedBoxId(box.id);
    setCurrentMode('verify_items');
    setManualBoxId('');
    showToast(`Box ${box.id} retrieved. Proceed to scan items.`, 'success');
  };

  const handleScanItem = (sku: string) => {
    if (!selectedBoxId) return;
    const cleanSku = sku.trim().toUpperCase();
    const box = boxes.find((b) => b.id === selectedBoxId);
    if (!box) return;

    const itemIndex = box.items.findIndex((i) => i.sku.toUpperCase() === cleanSku);

    if (itemIndex === -1) {
      showToast(`Discrepancy: SKU ${cleanSku} not expected in ${selectedBoxId}!`, 'error');
      return;
    }

    const item = box.items[itemIndex];
    if (item.scanned >= item.expected) {
      showToast(`Overage: ${cleanSku} already verified.`, 'info');
      return;
    }

    // Update scanned count
    setBoxes((prevBoxes) => {
      return prevBoxes.map((b) => {
        if (b.id !== selectedBoxId) return b;
        const updatedItems = [...b.items];
        updatedItems[itemIndex] = {
          ...item,
          scanned: item.scanned + 1,
        };
        return {
          ...b,
          items: updatedItems,
        };
      });
    });

    showToast(`Scanned ${item.desc} (${cleanSku})`, 'success');
    setManualItemId('');
  };

  const handleCompleteBox = () => {
    if (!selectedBoxId) return;
    const box = boxes.find((b) => b.id === selectedBoxId);
    if (!box) return;

    const hasDiscrepancy = box.items.some((i) => i.scanned !== i.expected);
    const boxStatus = hasDiscrepancy ? 'discrepant' : 'verified';

    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id === selectedBoxId) {
          return { ...b, status: boxStatus };
        }
        return b;
      })
    );

    showToast(`Box ${selectedBoxId} finalized.`, boxStatus === 'verified' ? 'success' : 'error');
    setCurrentMode('dashboard');
    setSelectedBoxId(null);
  };

  // Helper values for active box
  const activeBox = boxes.find((b) => b.id === selectedBoxId);
  const totalExpected = activeBox ? activeBox.items.reduce((sum, i) => sum + i.expected, 0) : 0;
  const totalScanned = activeBox ? activeBox.items.reduce((sum, i) => sum + i.scanned, 0) : 0;
  const boxProgress = totalExpected > 0 ? (totalScanned / totalExpected) * 100 : 0;
  const isBoxComplete = totalExpected > 0 && totalScanned === totalExpected;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#131316]">
      {/* View Toast Notification */}
      {toast && (
        <View
          style={{ zIndex: 999 }}
          className={`absolute left-4 right-4 top-12 flex-row items-center gap-2.5 rounded-lg border p-3 ${
            toast.type === 'success'
              ? 'border-[#22c55e] bg-[#22c55e]/10'
              : toast.type === 'error'
                ? 'border-[#ef4444] bg-[#ef4444]/10'
                : 'border-[#3f3f46] bg-[#1f1f22]'
          }`}>
          {toast.type === 'success' && <Check color="#22c55e" size={18} />}
          {toast.type === 'error' && <AlertTriangle color="#ef4444" size={18} />}
          <Text className="flex-1 font-hanken text-xs font-semibold text-[#fafafa]">
            {toast.text}
          </Text>
          <TouchableOpacity onPress={() => setToast(null)}>
            <X color="#a1a1aa" size={16} />
          </TouchableOpacity>
        </View>
      )}

      {/* DASHBOARD MODE */}
      {currentMode === 'dashboard' && (
        <View className="flex-1">
          {/* Custom Header */}
          <View className="flex-row items-center justify-between border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
            <View className="flex-row items-center gap-3">
              <Text className="font-hanken text-xl font-bold text-[#fafafa]">
                Receiving Dashboard
              </Text>
            </View>
            <TouchableOpacity className="h-9 w-9 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#1f1f22]">
              <User color="#fafafa" size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Quick Actions Buttons */}
            <View className="mb-8 flex-row gap-4">
              <TouchableOpacity
                onPress={() => setCurrentMode('scan_box')}
                className="flex-1 items-center justify-center gap-2 rounded-lg bg-[#e5005c] py-8">
                <Scan color="#ffffff" size={28} />
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                  Scan New Box
                </Text>
              </TouchableOpacity>
            </View>

            {/* Step 1: Upload Box Manifest */}
            <TouchableOpacity
              onPress={handleUpload}
              disabled={isUploading}
              className="mb-4 items-center justify-center rounded-lg border border-dashed border-[#3f3f46] bg-[#1f1f22]/20 p-8">
              {isUploading ? (
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]/50">
                  <ActivityIndicator color="#e5005c" size="small" />
                </View>
              ) : (
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]/50">
                  <FileUp color="#e5005c" size={24} />
                </View>
              )}
              <Text className="mb-1 font-hanken text-base font-bold text-[#fafafa]">
                Step 1: Upload Box Manifest
              </Text>
              <Text className="mb-5 max-w-[250px] text-center font-hanken text-xs text-[#a1a1aa]">
                Upload CSV containing box-level data
              </Text>
              <View className="rounded border border-[#3f3f46] bg-[#2a2a2d] px-3 py-1.5">
                <Text className="font-mono text-[10px] text-[#a1a1aa]">.CSV</Text>
              </View>
            </TouchableOpacity>

            {/* Step 2: Upload Scanning Data */}
            <TouchableOpacity
              onPress={handleUploadScanningData}
              disabled={isUploading}
              className="mb-8 items-center justify-center rounded-lg border border-dashed border-[#3f3f46] bg-[#1f1f22]/20 p-8">
              {isUploading ? (
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]/50">
                  <ActivityIndicator color="#e5005c" size="small" />
                </View>
              ) : (
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#2a2a2d]/50">
                  <Scan color="#e5005c" size={24} />
                </View>
              )}
              <Text className="mb-1 font-hanken text-base font-bold text-[#fafafa]">
                Step 2: Upload Scanning Data
              </Text>
              <Text className="mb-5 max-w-[250px] text-center font-hanken text-xs text-[#a1a1aa]">
                Upload CSV containing item-level scan logs
              </Text>
              <View className="rounded border border-[#3f3f46] bg-[#2a2a2d] px-3 py-1.5">
                <Text className="font-mono text-[10px] text-[#a1a1aa]">.CSV</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* SCAN BOX BARCODE MODE */}
      {currentMode === 'scan_box' && (
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-3 border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
            <TouchableOpacity onPress={() => setCurrentMode('dashboard')}>
              <ArrowLeft color="#fafafa" size={22} />
            </TouchableOpacity>
            <Text className="font-hanken text-xl font-bold text-[#fafafa]">Scan Box Barcode</Text>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Viewfinder Canvas */}
            <View className="relative mb-4 h-64 items-center justify-center overflow-hidden rounded-lg border border-[#3f3f46] bg-black">
              <Camera color="#1f1f22" size={56} className="opacity-30" />

              {/* Brackets */}
              <View className="absolute left-6 top-6 h-8 w-8 border-l-2 border-t-2 border-[#e5005c]" />
              <View className="absolute right-6 top-6 h-8 w-8 border-r-2 border-t-2 border-[#e5005c]" />
              <View className="absolute bottom-6 left-6 h-8 w-8 border-b-2 border-l-2 border-[#e5005c]" />
              <View className="absolute bottom-6 right-6 h-8 w-8 border-b-2 border-r-2 border-[#e5005c]" />

              {/* Red Laser Scanning Line */}
              <Animated.View
                style={{
                  transform: [
                    {
                      translateY: scannerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-80, 80],
                      }),
                    },
                  ],
                }}
                className="absolute left-6 right-6 h-[2px] bg-[#ef4444] shadow shadow-[#ef4444]"
              />

              <Text className="absolute bottom-6 rounded bg-black/70 px-2.5 py-1 font-jetbrains text-[10px] text-[#a1a1aa]">
                ALIGN BOX BARCODE IN VIEW
              </Text>
            </View>

            {/* Manual Barcode Input */}
            <View className="flex-row items-center gap-2">
              <TextInput
                value={manualBoxId}
                onChangeText={setManualBoxId}
                placeholder="Enter Box ID (e.g. BOX-25-B)"
                placeholderTextColor="#a1a1aa"
                autoCapitalize="characters"
                className="h-11 flex-1 rounded-lg border border-[#3f3f46] bg-[#1f1f22] px-3 py-2 font-jetbrains text-sm text-[#fafafa]"
              />
              <TouchableOpacity
                onPress={() => handleScanBox(manualBoxId)}
                className="h-11 items-center justify-center rounded-lg bg-[#e5005c] px-5">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">VERIFY</Text>
              </TouchableOpacity>
            </View>

            {/* Simulation Scenarios */}
            <View className="mb-8 mt-6">
              <Text className="mb-3 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                Barcode Simulation Controls
              </Text>

              {/* Box 25-B simulation */}
              <TouchableOpacity
                onPress={() => handleScanBox('BOX-25-B')}
                className="mb-2.5 flex-row items-center justify-between rounded-lg border border-[#3f3f46] bg-[#1f1f22] p-3.5">
                <View className="flex-row items-center gap-3">
                  <Package color="#22c55e" size={20} />
                  <View>
                    <Text className="font-hanken text-xs font-bold text-[#fafafa]">
                      Scan Box BOX-25-B
                    </Text>
                    <Text className="mt-0.5 font-hanken text-[10px] text-[#a1a1aa]">
                      Valid box in manifest (3 items expected)
                    </Text>
                  </View>
                </View>
                <View className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#22c55e]">VALID</Text>
                </View>
              </TouchableOpacity>

              {/* Box 24-A simulation */}
              <TouchableOpacity
                onPress={() => handleScanBox('BOX-24-A')}
                className="mb-2.5 flex-row items-center justify-between rounded-lg border border-[#3f3f46] bg-[#1f1f22] p-3.5">
                <View className="flex-row items-center gap-3">
                  <Package color="#ef4444" size={20} />
                  <View>
                    <Text className="font-hanken text-xs font-bold text-[#fafafa]">
                      Scan Box BOX-24-A
                    </Text>
                    <Text className="mt-0.5 font-hanken text-[10px] text-[#a1a1aa]">
                      Discrepant box (1 expected item)
                    </Text>
                  </View>
                </View>
                <View className="rounded border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 py-0.5">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#ef4444]">
                    MISMATCH
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Box 26-C simulation */}
              <TouchableOpacity
                onPress={() => handleScanBox('BOX-26-C')}
                className="mb-2.5 flex-row items-center justify-between rounded-lg border border-[#3f3f46] bg-[#1f1f22] p-3.5">
                <View className="flex-row items-center gap-3">
                  <Package color="#22c55e" size={20} />
                  <View>
                    <Text className="font-hanken text-xs font-bold text-[#fafafa]">
                      Scan Box BOX-26-C
                    </Text>
                    <Text className="mt-0.5 font-hanken text-[10px] text-[#a1a1aa]">
                      Valid box in manifest (5 items expected)
                    </Text>
                  </View>
                </View>
                <View className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#22c55e]">VALID</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* VERIFY BOX ITEMS MODE */}
      {currentMode === 'verify_items' && activeBox && (
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-3 border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
            <TouchableOpacity onPress={() => setCurrentMode('scan_box')}>
              <ArrowLeft color="#fafafa" size={22} />
            </TouchableOpacity>
            <View>
              <Text className="font-hanken text-lg font-bold text-[#fafafa]">Verify Box Items</Text>
              <Text className="font-jetbrains text-[10px] text-[#a1a1aa]">{selectedBoxId}</Text>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Box Progress Status Card */}
            <View className="mb-4 rounded-lg border border-[#3f3f46] bg-[#1f1f22] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                  Box Verification Status
                </Text>
                <View
                  className={`rounded border px-2 py-0.5 ${
                    activeBox.status === 'verified'
                      ? 'border-[#22c55e] bg-[#22c55e]/10'
                      : activeBox.status === 'discrepant'
                        ? 'border-[#ef4444] bg-[#ef4444]/10'
                        : 'border-[#eab308] bg-[#eab308]/10'
                  }`}>
                  <Text
                    className={`font-jetbrains text-[9px] font-bold ${
                      activeBox.status === 'verified'
                        ? 'text-[#22c55e]'
                        : activeBox.status === 'discrepant'
                          ? 'text-[#ef4444]'
                          : 'text-[#eab308]'
                    }`}>
                    {activeBox.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <Text className="font-hanken text-xs text-[#a1a1aa]">Items Scanned</Text>
                <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                  {totalScanned} / {totalExpected}
                </Text>
              </View>

              {/* Progress Bar */}
              <View className="mt-2 h-1.5 overflow-hidden rounded-md bg-[#353438]">
                <View
                  style={{ width: `${boxProgress}%` }}
                  className="h-full rounded-md bg-[#e5005c]"
                />
              </View>
            </View>

            {/* Expected Items List */}
            <Text className="mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              Expected Items Manifest
            </Text>

            {activeBox.items.map((item, idx) => {
              const isItemComplete = item.scanned === item.expected;
              return (
                <View
                  key={idx}
                  className={`mb-2 flex-row items-center justify-between rounded-lg border bg-[#1b1b1e] p-3.5 ${
                    isItemComplete ? 'border-[#22c55e]/50' : 'border-[#3f3f46]'
                  }`}>
                  <View className="mr-2 flex-1">
                    <Text className="font-mono text-xs font-bold tracking-wider text-[#fafafa]">
                      {item.sku}
                    </Text>
                    <Text className="mt-0.5 font-hanken text-[10px] text-[#a1a1aa]">
                      {item.desc}
                    </Text>
                  </View>
                  <View
                    className={`flex-row items-center gap-2 rounded border px-3 py-1 ${
                      isItemComplete
                        ? 'border-[#22c55e] bg-[#22c55e]/15'
                        : 'border-[#3f3f46] bg-[#2a2a2d]'
                    }`}>
                    {isItemComplete && <Check color="#22c55e" size={12} />}
                    <Text
                      className={`font-jetbrains text-[10px] font-bold ${
                        isItemComplete ? 'text-[#22c55e]' : 'text-[#fafafa]'
                      }`}>
                      {item.scanned} / {item.expected}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Item Barcode Entry */}
            <View className="mt-4 flex-row items-center gap-2">
              <TextInput
                value={manualItemId}
                onChangeText={setManualItemId}
                placeholder="Scan item barcode SKU..."
                placeholderTextColor="#a1a1aa"
                autoCapitalize="characters"
                className="h-11 flex-1 rounded-lg border border-[#3f3f46] bg-[#1f1f22] px-3 py-2 font-jetbrains text-sm text-[#fafafa]"
              />
              <TouchableOpacity
                onPress={() => handleScanItem(manualItemId)}
                className="h-11 items-center justify-center rounded-lg bg-[#e5005c] px-5">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">SCAN</Text>
              </TouchableOpacity>
            </View>

            {/* Simulation triggers for items */}
            <View className="mb-8 mt-6">
              <Text className="mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                Simulated Barcode Scanner
              </Text>

              {activeBox.items.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleScanItem(item.sku)}
                  className="mb-2 flex-row items-center justify-between rounded-lg border border-[#3f3f46] bg-[#1f1f22] p-3">
                  <View className="flex-row items-center gap-3">
                    <Scan color="#e5005c" size={16} />
                    <View>
                      <Text className="font-hanken text-xs font-semibold text-[#fafafa]">
                        Scan Barcode: {item.sku}
                      </Text>
                      <Text className="font-hanken text-[9px] text-[#a1a1aa]">
                        Increment scan count for {item.desc}
                      </Text>
                    </View>
                  </View>
                  <View className="rounded border border-[#e5005c]/20 bg-[#e5005c]/10 px-2 py-0.5">
                    <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">
                      +1 SCAN
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => handleScanItem('SKU-ERR-99')}
                className="flex-row items-center justify-between rounded-lg border border-[#3f3f46] bg-[#1f1f22] p-3">
                <View className="flex-row items-center gap-3">
                  <Scan color="#ef4444" size={16} />
                  <View>
                    <Text className="font-hanken text-xs font-semibold text-[#fafafa]">
                      Scan Unexpected Barcode
                    </Text>
                    <Text className="font-hanken text-[9px] text-[#a1a1aa]">
                      Simulate scanning a wrong item SKU
                    </Text>
                  </View>
                </View>
                <View className="rounded border border-[#ef4444]/20 bg-[#ef4444]/10 px-2 py-0.5">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#ef4444]">
                    MISMATCH
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Box finalization footer */}
            <View className="mb-8">
              <TouchableOpacity
                onPress={handleCompleteBox}
                className={`items-center justify-center rounded-lg py-3.5 ${
                  isBoxComplete ? 'bg-[#e5005c]' : 'bg-[#ef4444]'
                }`}>
                <Text
                  className={`font-jetbrains text-sm font-bold ${
                    isBoxComplete ? 'text-[#ffffff]' : 'text-[#fafafa]'
                  }`}>
                  {isBoxComplete ? 'Complete Box & Verify' : 'Force Close & Flag Discrepancy'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
