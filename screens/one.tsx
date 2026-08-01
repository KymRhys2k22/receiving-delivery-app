import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Scan,
  AlertTriangle,
  User,
  Check,
  X,
  Camera,
  Box as BoxIcon,
  Store,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth';
import { StatusBar } from 'expo-status-bar';
import {
  MANIFEST_CIDS_KEY,
  SCANNED_CIDS_KEY,
  MANIFEST_ITEMS_KEY,
  SCANNED_ITEMS_KEY,
  SCAN_HISTORY_KEY,
  type ItemManifestRecord,
  saveSessionToHistory,
} from '../utils/storage';

export {
  MANIFEST_CIDS_KEY,
  SCANNED_CIDS_KEY,
  MANIFEST_ITEMS_KEY,
  SCANNED_ITEMS_KEY,
  SCAN_HISTORY_KEY,
  type ItemManifestRecord,
};

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
  const { storeCode, storeName } = useAuth();
  const [currentMode, setCurrentMode] = useState<'dashboard' | 'verify_items'>('dashboard');

  // Track boxes
  const [boxes, setBoxes] = useState<Box[]>(INITIAL_BOXES);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Input fields
  const [manualItemId, setManualItemId] = useState('');

  // Toast / Status banner
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  // Upload manifest simulation
  const [isUploading, setIsUploading] = useState(false);

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

  // Active session scanning progress
  const [savedProgress, setSavedProgress] = useState<{
    scanned: number;
    total: number;
  } | null>(null);

  const [savedItemProgress, setSavedItemProgress] = useState<{
    scanned: number;
    total: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const checkProgress = async () => {
        try {
          // 1. Box CID Progress
          const storedManifest = await AsyncStorage.getItem(MANIFEST_CIDS_KEY);
          const storedScanned = await AsyncStorage.getItem(SCANNED_CIDS_KEY);

          if (storedManifest) {
            const allCids = JSON.parse(storedManifest) as string[];
            const scannedCids = storedScanned ? (JSON.parse(storedScanned) as string[]) : [];

            const uniqueManifest = Array.from(
              new Set(allCids.map((c) => c.trim()).filter(Boolean))
            );
            const uniqueScanned = Array.from(
              new Set(scannedCids.map((c) => c.trim()).filter(Boolean))
            );

            setSavedProgress({
              scanned: uniqueScanned.length,
              total: uniqueManifest.length,
            });
          } else {
            setSavedProgress(null);
          }

          // 2. Item Progress
          const storedManifestItems = await AsyncStorage.getItem(MANIFEST_ITEMS_KEY);
          const storedScannedItems = await AsyncStorage.getItem(SCANNED_ITEMS_KEY);

          if (storedManifestItems) {
            const itemsList = JSON.parse(storedManifestItems) as ItemManifestRecord[];
            const scannedMap = storedScannedItems
              ? (JSON.parse(storedScannedItems) as Record<string, number>)
              : {};

            const totalExpected = itemsList.reduce((sum, item) => sum + (item.qty || 1), 0);
            const totalScanned = itemsList.reduce(
              (sum, item) => sum + (scannedMap[item.id] || 0),
              0
            );

            setSavedItemProgress({
              scanned: totalScanned,
              total: totalExpected,
            });
          } else {
            setSavedItemProgress(null);
          }
        } catch {
          setSavedProgress(null);
          setSavedItemProgress(null);
        }
      };
      checkProgress();
    }, [])
  );

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

        // Extract the "CID NO" column (trim whitespace and deduplicate case-insensitively)
        const seenCids = new Set<string>();
        const cidList: string[] = [];

        parsed.data.forEach((row) => {
          const key = Object.keys(row).find((k) => k.trim() === 'CID NO');
          const val = key ? row[key].trim() : '';
          const upper = val.toUpperCase();
          if (val && !seenCids.has(upper)) {
            seenCids.add(upper);
            cidList.push(val);
          }
        });

        if (cidList.length === 0) {
          setIsUploading(false);
          showToast('No "CID NO" column found in CSV', 'error');
          return;
        }

        // Reset scanned CIDs and persist new manifest to AsyncStorage
        await AsyncStorage.removeItem(SCANNED_CIDS_KEY);
        await AsyncStorage.setItem(MANIFEST_CIDS_KEY, JSON.stringify(cidList));

        // Save session to History (for History tab grouped by date)
        await saveSessionToHistory({
          type: 'box',
          fileName: asset.name,
          totalCount: cidList.length,
          scannedCount: 0,
          manifestData: cidList,
          scannedData: [],
        });

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
    } catch (error: unknown) {
      setIsUploading(false);
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[handleUpload]', msg);
      showToast(`Upload failed: ${msg}`, 'error');
    }
  };

  /**
   * Step 2 — Upload Scanning Items CSV.
   * Schema: CID NO, TRF NO, UPC, SKU, DESCRIPTION, QTY
   * Persists items to AsyncStorage for scanningItem.tsx.
   */
  const handleUploadScanningData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const asset = result.assets[0];

        const csvText = await fetch(asset.uri).then((r) => r.text());

        const parsed = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
        });

        const fatalErrors = parsed.errors.filter((e) => e.type !== 'Delimiter');
        if (fatalErrors.length > 0) {
          setIsUploading(false);
          showToast(`CSV parse error: ${fatalErrors[0].message}`, 'error');
          return;
        }

        const getRowVal = (row: Record<string, string>, targetHeader: string): string => {
          const cleanTarget = targetHeader.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const key = Object.keys(row).find(
            (k) => k.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanTarget
          );
          return key && row[key] ? row[key].trim() : '';
        };

        const itemsList: ItemManifestRecord[] = [];
        parsed.data.forEach((row, idx) => {
          const cid = getRowVal(row, 'CID NO');
          const trf = getRowVal(row, 'TRF NO');
          const upc = getRowVal(row, 'UPC');
          const sku = getRowVal(row, 'SKU');
          const description = getRowVal(row, 'DESCRIPTION');
          const rawQty = getRowVal(row, 'QTY');
          const qty = parseInt(rawQty, 10) || 1;

          if (cid || trf || upc || sku || description) {
            itemsList.push({
              id: `item_${idx}_${sku || upc || idx}`,
              cid,
              trf,
              upc,
              sku,
              description,
              qty: Math.max(1, qty),
            });
          }
        });

        if (itemsList.length === 0) {
          setIsUploading(false);
          showToast(
            'No items found in CSV matching schema (CID NO, TRF NO, UPC, SKU, DESCRIPTION, QTY)',
            'error'
          );
          return;
        }

        await AsyncStorage.removeItem(SCANNED_ITEMS_KEY);
        await AsyncStorage.setItem(MANIFEST_ITEMS_KEY, JSON.stringify(itemsList));

        // Save session to History (for History tab grouped by date)
        const totalQty = itemsList.reduce((sum, item) => sum + (item.qty || 1), 0);
        await saveSessionToHistory({
          type: 'item',
          fileName: asset.name,
          totalCount: totalQty,
          scannedCount: 0,
          manifestData: itemsList,
          scannedData: {},
        });

        setIsUploading(false);
        showToast(
          `Item manifest uploaded: ${itemsList.length} items from ${asset.name}`,
          'success'
        );

        navigation.navigate('ScanningItem' as never);
      }
    } catch (error: unknown) {
      setIsUploading(false);
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[handleUploadScanningData]', msg);
      showToast(`Upload failed: ${msg}`, 'error');
    }
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
    <SafeAreaView className="flex-1 bg-[#131316]">
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
              <Text className="font-hanken text-lg font-bold text-[#fafafa]">
                Receiving Dashboard
              </Text>
            </View>
            <View className="max-w-[200px] flex-row items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#1f1f22] px-2.5 py-1.5">
              <Store color="#e5005c" size={14} />
              <Text className="font-jetbrains text-xs font-bold text-[#fafafa]" numberOfLines={1}>
                {storeName ? `${storeName} (${storeCode})` : storeCode || 'N/A'}
              </Text>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Active Box (CID) Session Resume Banner (This from @scanningBox.tsx)*/}
            {savedProgress && savedProgress.total > 0 && (
              <View className="mb-6 rounded-xl border border-[#ff80ab]/40 bg-[#ff80ab]/10 p-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <BoxIcon color="#ff80ab" size={20} />
                    <Text className="font-hanken text-sm font-bold text-[#fafafa]">
                      Active Box (CID) Session
                    </Text>
                  </View>
                  <Text className="font-jetbrains text-xs font-bold text-[#ff80ab]">
                    {savedProgress.scanned}/{savedProgress.total} Scanned
                  </Text>
                </View>

                <Text className="mb-3 font-hanken text-xs text-[#a1a1aa]">
                  {savedProgress.scanned === savedProgress.total
                    ? 'All boxes in manifest scanned! Resume or reset session anytime.'
                    : 'Saved scanning progress detected. Resume scanning right where you left off.'}
                </Text>

                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ScanningBox' as never)}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#ff80ab] py-2.5">
                    <Camera color="#131316" size={16} />
                    <Text className="font-jetbrains text-xs font-bold text-[#131316]">
                      {savedProgress.scanned > 0 ? 'RESUME SCANNING' : 'START SCANNING'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => {
                      await AsyncStorage.removeItem(SCANNED_CIDS_KEY);
                      setSavedProgress((prev) => (prev ? { ...prev, scanned: 0 } : null));
                      showToast('Scanning progress reset', 'info');
                    }}
                    className="rounded-lg border border-[#3f3f46] bg-[#1f1f22] px-3.5 py-2.5">
                    <Text className="font-jetbrains text-xs font-semibold text-[#a1a1aa]">
                      RESET
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Active Item Session Resume Banner (from @scanningItem.tsx) */}
            {savedItemProgress && savedItemProgress.total > 0 && (
              <View className="mb-6 rounded-xl border border-[#e5005c]/40 bg-[#e5005c]/10 p-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Scan color="#e5005c" size={20} />
                    <Text className="font-hanken text-sm font-bold text-[#fafafa]">
                      Active Item Session
                    </Text>
                  </View>
                  <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                    {savedItemProgress.scanned}/{savedItemProgress.total} Scanned
                  </Text>
                </View>

                <Text className="mb-3 font-hanken text-xs text-[#a1a1aa]">
                  {savedItemProgress.scanned === savedItemProgress.total
                    ? 'All items in manifest scanned! Resume or reset session anytime.'
                    : 'Saved item scanning progress detected. Resume scanning right where you left off.'}
                </Text>

                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ScanningItem' as never)}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#e5005c] py-2.5">
                    <Camera color="#ffffff" size={16} />
                    <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                      {savedItemProgress.scanned > 0 ? 'RESUME SCANNING' : 'START SCANNING'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => {
                      await AsyncStorage.removeItem(SCANNED_ITEMS_KEY);
                      setSavedItemProgress((prev) => (prev ? { ...prev, scanned: 0 } : null));
                      showToast('Item scanning progress reset', 'info');
                    }}
                    className="rounded-lg border border-[#3f3f46] bg-[#1f1f22] px-3.5 py-2.5">
                    <Text className="font-jetbrains text-xs font-semibold text-[#a1a1aa]">
                      RESET
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
                  <BoxIcon color="#e5005c" size={24} />
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
                Step 2: Upload Scanning Items
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

      {/* VERIFY BOX ITEMS MODE */}
      {currentMode === 'verify_items' && activeBox && (
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-3 border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
            <TouchableOpacity onPress={() => setCurrentMode('dashboard')}>
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
    </SafeAreaView>
  );
}
