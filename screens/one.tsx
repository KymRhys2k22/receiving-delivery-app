import React, { useState, useEffect, useCallback, useContext } from 'react';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {
  ArrowLeft,
  Scan,
  AlertTriangle,
  Check,
  X,
  Camera,
  Box as BoxIcon,
  Store,
  Warehouse,
  FileText,
  ChevronRight,
  RotateCcw,
  Trash2,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/theme';
import {
  MANIFEST_CIDS_KEY,
  SCANNED_CIDS_KEY,
  MANIFEST_ITEMS_KEY,
  SCANNED_ITEMS_KEY,
  SCAN_HISTORY_KEY,
  ACTIVE_BOX_FILE_KEY,
  ACTIVE_ITEM_FILE_KEY,
  type ItemManifestRecord,
  type BoxManifestRecord,
  saveSessionToHistory,
} from '../utils/storage';

export {
  MANIFEST_CIDS_KEY,
  SCANNED_CIDS_KEY,
  MANIFEST_ITEMS_KEY,
  SCANNED_ITEMS_KEY,
  SCAN_HISTORY_KEY,
  ACTIVE_BOX_FILE_KEY,
  ACTIVE_ITEM_FILE_KEY,
  type ItemManifestRecord,
  type BoxManifestRecord,
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

function SessionBanner({
  title,
  fileName,
  scanned,
  total,
  subtitle,
  icon: Icon,
  accent,
  onResume,
  onReset,
  onClear,
}: {
  title: string;
  fileName?: string;
  scanned: number;
  total: number;
  subtitle?: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  accent: string;
  onResume: () => void;
  onReset: () => void;
  onClear?: () => void;
}) {
  const { isDark } = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
  const complete = total > 0 && scanned >= total;

  return (
    <View
      className="mb-4 overflow-hidden rounded-xl border p-4"
      style={{ borderColor: `${accent}55`, backgroundColor: `${accent}12` }}>
      <View className="mb-2.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}26` }}>
            <Icon color={accent} size={18} />
          </View>
          <View className="max-w-[190px]">
            <Text
              className={`font-hanken text-sm font-bold ${isDark ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
              {title}
            </Text>
            {fileName ? (
              <Text
                className="font-jetbrains text-[10px] text-[#a1a1aa]"
                numberOfLines={1}
                ellipsizeMode="middle">
                📄 {fileName}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {complete && (
            <View className="rounded-full bg-[#22c55e]/20 px-2 py-0.5">
              <Text className="font-jetbrains text-[8px] font-bold text-[#22c55e]">COMPLETED</Text>
            </View>
          )}
          <Text className="font-jetbrains text-[11px] font-bold" style={{ color: accent }}>
            {scanned}/{total} ({pct}%)
          </Text>
        </View>
      </View>

      <View
        className="mb-3 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: `${accent}26` }}>
        <View
          style={{ width: `${pct}%`, backgroundColor: accent }}
          className="h-full rounded-full"
        />
      </View>

      <Text
        className={`mb-3 font-hanken text-[11px] ${isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]'}`}>
        {complete
          ? 'All entries in this manifest are scanned. Resume to review or reset the session.'
          : subtitle ||
            `Saved progress: ${scanned} of ${total} scanned (${Math.max(0, total - scanned)} remaining).`}
      </Text>

      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          onPress={onResume}
          activeOpacity={0.85}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg py-2.5"
          style={{ backgroundColor: accent }}>
          <Camera color="#131316" size={15} />
          <Text className="font-jetbrains text-xs font-bold text-[#131316]">
            {scanned > 0 ? 'RESUME SCANNING' : 'START SCANNING'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onReset}
          activeOpacity={0.7}
          className="flex-row items-center gap-1.5 rounded-lg border px-3 py-2.5"
          style={{ borderColor: `${accent}44` }}>
          <RotateCcw color="#a1a1aa" size={13} />
          <Text className="font-jetbrains text-xs font-semibold text-[#a1a1aa]">RESET</Text>
        </TouchableOpacity>
        {onClear && (
          <TouchableOpacity
            onPress={onClear}
            activeOpacity={0.7}
            className="flex-row items-center gap-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5">
            <Trash2 color="#ef4444" size={13} />
            <Text className="font-jetbrains text-xs font-semibold text-[#ef4444]">CLEAR</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2.5 mt-1 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
      {children}
    </Text>
  );
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

interface ProgressState {
  scanned: number;
  total: number;
  fileName?: string;
  itemCount?: number;
}

export default function TabOneScreen({ navigation: propNavigation }: { navigation?: any } = {}) {
  const contextNavigation = useContext(NavigationContext);
  const navigation = propNavigation || contextNavigation;
  const { storeCode, storeName } = useAuth();
  const { isDark } = useTheme();
  const [currentMode, setCurrentMode] = useState<'dashboard' | 'verify_items'>('dashboard');

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1b1b1e] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerCardBgClass = isDark
    ? 'bg-[#1f1f22] border-[#3f3f46]'
    : 'bg-[#fafafa] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  // Track boxes
  const [boxes, setBoxes] = useState<Box[]>(INITIAL_BOXES);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Input fields
  const [manualItemId, setManualItemId] = useState('');

  // Toast / Status banner
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  // Upload manifest state
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
  const [savedProgress, setSavedProgress] = useState<ProgressState | null>(null);
  const [savedItemProgress, setSavedItemProgress] = useState<ProgressState | null>(null);

  const checkProgress = useCallback(async () => {
    try {
      // 1. Box CID Progress
      const storedManifest = await AsyncStorage.getItem(MANIFEST_CIDS_KEY);
      const storedScanned = await AsyncStorage.getItem(SCANNED_CIDS_KEY);
      const storedBoxFileName = await AsyncStorage.getItem(ACTIVE_BOX_FILE_KEY);

      if (storedManifest) {
        const rawManifest = JSON.parse(storedManifest) as any[];
        const rawScanned = storedScanned ? (JSON.parse(storedScanned) as any[]) : [];

        const getCidStr = (item: any) =>
          (typeof item === 'string' ? item : item?.cid || '').trim();

        const uniqueManifest = Array.from(
          new Set((Array.isArray(rawManifest) ? rawManifest : []).map(getCidStr).filter(Boolean))
        );
        const uniqueScanned = Array.from(
          new Set((Array.isArray(rawScanned) ? rawScanned : []).map(getCidStr).filter(Boolean))
        );

        if (uniqueManifest.length > 0) {
          const manifestCidSet = new Set(uniqueManifest.map((c) => c.toUpperCase()));
          const matchedScanned = uniqueScanned.filter((c) => manifestCidSet.has(c.toUpperCase()));

          setSavedProgress({
            scanned: Math.min(matchedScanned.length, uniqueManifest.length),
            total: uniqueManifest.length,
            fileName: storedBoxFileName || undefined,
          });
        } else {
          setSavedProgress(null);
        }
      } else {
        setSavedProgress(null);
      }

      // 2. Item Progress
      const storedItemManifest = await AsyncStorage.getItem(MANIFEST_ITEMS_KEY);
      const storedScannedItems = await AsyncStorage.getItem(SCANNED_ITEMS_KEY);
      const storedItemFileName = await AsyncStorage.getItem(ACTIVE_ITEM_FILE_KEY);

      if (storedItemManifest) {
        const manifestItems = JSON.parse(storedItemManifest) as ItemManifestRecord[];
        const scannedMap = storedScannedItems
          ? (JSON.parse(storedScannedItems) as Record<string, number>)
          : {};

        if (Array.isArray(manifestItems) && manifestItems.length > 0) {
          const totalQty = manifestItems.reduce((sum, item) => sum + (item.qty || 1), 0);
          const scannedQty = manifestItems.reduce(
            (sum, item) => sum + (scannedMap[item.id] || 0),
            0
          );

          setSavedItemProgress({
            scanned: Math.min(scannedQty, totalQty),
            total: totalQty,
            fileName: storedItemFileName || undefined,
            itemCount: manifestItems.length,
          });
        } else {
          setSavedItemProgress(null);
        }
      } else {
        setSavedItemProgress(null);
      }
    } catch (err) {
      console.error('[checkProgress] Error reading progress:', err);
      setSavedProgress(null);
      setSavedItemProgress(null);
    }
  }, []);

  // Check progress immediately on focus (runs on mount, tab switches, and navigating back from scanners)
  useFocusEffect(
    useCallback(() => {
      checkProgress();
    }, [checkProgress])
  );

  /**
   * Step 1 — Upload Box Manifest CSV.
   * Parses with PapaParse, extracts the "CID NO" column,
   * persists the list to AsyncStorage, updates state instantly, and opens Box Scanner.
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

        // Read raw CSV text — strip BOM
        const rawCsvText = await fetch(asset.uri).then((r) => r.text());
        const csvText = rawCsvText.replace(/^\uFEFF/, '').trim();

        // Parse with PapaParse
        const parsed = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: 'greedy',
          transformHeader: (h) => h.trim().replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, ''),
        });

        // Only abort on fatal errors (not delimiter detection warnings)
        const fatalErrors = parsed.errors.filter((e) => e.type !== 'Delimiter');
        if (fatalErrors.length > 0) {
          setIsUploading(false);
          showToast(`CSV parse error: ${fatalErrors[0].message}`, 'error');
          return;
        }

        // Extract the "CID NO" and "TRF NO"
        const seenCids = new Set<string>();
        const boxList: BoxManifestRecord[] = [];

        parsed.data.forEach((row) => {
          const getRowVal = (r: Record<string, string>, targets: string[]) => {
            const k = Object.keys(r).find((key) =>
              targets.some((t) => t.toUpperCase() === key.trim().toUpperCase())
            );
            return k ? (r[k] || '').trim() : '';
          };

          const cid =
            getRowVal(row, [
              'CID NO',
              'CID',
              'CID_NO',
              'CIDNO',
              'BOX CID',
              'BOX CID NO',
              'BOX NO',
              'BOX',
              'CONTAINER',
            ]) ||
            (parsed.meta.fields && parsed.meta.fields[0]
              ? (row[parsed.meta.fields[0]] || '').trim()
              : '');

          const trf =
            getRowVal(row, [
              'TRF NO',
              'TRF',
              'TRF_NO',
              'TRFNO',
              'TRANSFER NO',
              'TRANSFER',
              'TRF NUMBER',
            ]) ||
            (parsed.meta.fields && parsed.meta.fields.length > 1
              ? (row[parsed.meta.fields[1]] || '').trim()
              : '');

          if (cid) {
            const upper = cid.toUpperCase();
            if (!seenCids.has(upper)) {
              seenCids.add(upper);
              boxList.push({ cid, trf });
            }
          }
        });

        if (boxList.length === 0) {
          setIsUploading(false);
          showToast('No "CID NO" column found in CSV', 'error');
          return;
        }

        // Reset scanned CIDs and persist new manifest to AsyncStorage
        await AsyncStorage.removeItem(SCANNED_CIDS_KEY);
        await AsyncStorage.setItem(MANIFEST_CIDS_KEY, JSON.stringify(boxList));
        await AsyncStorage.setItem(ACTIVE_BOX_FILE_KEY, asset.name);

        // Save session to History (for History tab grouped by date)
        await saveSessionToHistory({
          type: 'box',
          fileName: asset.name,
          totalCount: boxList.length,
          scannedCount: 0,
          manifestData: boxList,
          scannedData: [],
        });

        // Immediately update state in screens/one.tsx so it appears instantaneously!
        setSavedProgress({
          scanned: 0,
          total: boxList.length,
          fileName: asset.name,
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
        showToast(`Box manifest uploaded: ${boxList.length} boxes from ${asset.name}`, 'success');

        // Refresh progress immediately
        await checkProgress();

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
   * Persists items to AsyncStorage, updates state instantly, and opens Item Scanner.
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

        const rawCsvText = await fetch(asset.uri).then((r) => r.text());
        const csvText = rawCsvText.replace(/^\uFEFF/, '').trim();

        const parsed = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: 'greedy',
          transformHeader: (h) => h.trim().replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, ''),
        });

        const fatalErrors = parsed.errors.filter((e) => e.type !== 'Delimiter');
        if (fatalErrors.length > 0) {
          setIsUploading(false);
          showToast(`CSV parse error: ${fatalErrors[0].message}`, 'error');
          return;
        }

        const itemsList: ItemManifestRecord[] = [];

        parsed.data.forEach((row, idx) => {
          const getRowVal = (r: Record<string, string>, targets: string[]) => {
            const k = Object.keys(r).find((key) =>
              targets.some((t) => t.toUpperCase() === key.trim().toUpperCase())
            );
            return k ? (r[k] || '').trim() : '';
          };

          const cid = getRowVal(row, ['CID NO', 'CID', 'CID_NO', 'CIDNO', 'BOX CID', 'BOX NO']);
          const trf = getRowVal(row, [
            'TRF NO',
            'TRF',
            'TRF_NO',
            'TRFNO',
            'TRANSFER NO',
            'TRANSFER',
          ]);
          const upc = getRowVal(row, [
            'UPC',
            'UPC NO',
            'UPC_NO',
            'BARCODE',
            'EAN',
            'EAN13',
            'UPC CODE',
          ]);
          const sku = getRowVal(row, [
            'SKU',
            'SKU NO',
            'SKU_NO',
            'ITEM CODE',
            'ITEM NO',
            'ITEM SKU',
            'PRODUCT CODE',
          ]);
          const description = getRowVal(row, [
            'DESCRIPTION',
            'DESC',
            'ITEM DESCRIPTION',
            'PRODUCT NAME',
            'PRODUCT DESCRIPTION',
            'NAME',
          ]);
          const rawQty = getRowVal(row, [
            'QTY',
            'QUANTITY',
            'EXPECTED QTY',
            'TOTAL QTY',
            'COUNT',
            'AMOUNT',
          ]);
          const parsedQty = parseInt(rawQty, 10);
          const qty = isNaN(parsedQty) || parsedQty <= 0 ? 1 : parsedQty;

          if (cid || trf || upc || sku || description) {
            itemsList.push({
              id: `item_${idx}_${sku || upc || idx}`,
              cid,
              trf,
              upc,
              sku,
              description,
              qty,
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
        await AsyncStorage.setItem(ACTIVE_ITEM_FILE_KEY, asset.name);

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

        // Immediately update state in screens/one.tsx so it appears instantaneously!
        setSavedItemProgress({
          scanned: 0,
          total: totalQty,
          fileName: asset.name,
          itemCount: itemsList.length,
        });

        setIsUploading(false);
        showToast(
          `Item manifest uploaded: ${itemsList.length} items (${totalQty} total qty) from ${asset.name}`,
          'success'
        );

        // Refresh progress immediately
        await checkProgress();

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

    const itemIndex = box.items.findIndex((i) => i.sku === cleanSku);

    if (itemIndex >= 0) {
      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id === selectedBoxId) {
            const updatedItems = [...b.items];
            const currentItem = updatedItems[itemIndex];
            updatedItems[itemIndex] = {
              ...currentItem,
              scanned: currentItem.scanned + 1,
            };
            return { ...b, items: updatedItems };
          }
          return b;
        })
      );
      showToast(`Scanned ${cleanSku} (+1 Qty)`, 'success');
      setManualItemId('');
    } else {
      showToast(`DISCREPANCY: ${cleanSku} not in Box ${selectedBoxId}!`, 'error');
    }
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
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className={`flex-1 ${bgClass}`}
      style={{ flex: 1, backgroundColor: isDark ? '#18181b' : '#ffffff' }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {/* View Toast Notification */}
      {toast && (
        <View
          style={{ zIndex: 999 }}
          className={`absolute left-4 right-4 top-16 flex-row items-center gap-2.5 rounded-xl border p-3 ${
            toast.type === 'success'
              ? 'border-[#22c55e] bg-[#22c55e]/10'
              : toast.type === 'error'
                ? 'border-[#ef4444] bg-[#ef4444]/10'
                : innerCardBgClass
          }`}>
          {toast.type === 'success' && (
            <View className="h-7 w-7 items-center justify-center rounded-full bg-[#22c55e]/20">
              <Check color="#22c55e" size={15} />
            </View>
          )}
          {toast.type === 'error' && (
            <View className="h-7 w-7 items-center justify-center rounded-full bg-[#ef4444]/20">
              <AlertTriangle color="#ef4444" size={15} />
            </View>
          )}
          <Text className={`flex-1 font-hanken text-xs font-semibold ${textPrimaryClass}`}>
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
          <View
            className={`flex-row items-center justify-between border-b px-4 py-2.5 ${headerBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#e5005c]/15">
                <Warehouse color="#e5005c" size={20} />
              </View>
              <View>
                <Text className={`font-hanken text-lg font-bold ${textPrimaryClass}`}>
                  Receiving Dashboard
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                  <Text className="font-jetbrains text-[9px] font-bold text-[#22c55e]">
                    ONLINE · VERIFICATION SYSTEM
                  </Text>
                </View>
              </View>
            </View>
            <View
              className={`max-w-[190px] flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${innerCardBgClass}`}>
              <Store color="#e5005c" size={14} />
              <Text
                className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}
                numberOfLines={1}>
                {storeName ? `${storeName} (${storeCode})` : storeCode || 'N/A'}
              </Text>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Quick Actions Shortcuts (Stitch UI Grid) */}
            <View className="mb-4 flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => navigation.navigate('ScanningBox' as never)}
                activeOpacity={0.8}
                className="flex-1 flex-col items-center justify-center rounded-xl border border-[#ff80ab]/30 bg-[#ff80ab]/10 p-3 active:bg-[#ff80ab]/20">
                <View className="mb-1.5 h-8 w-8 items-center justify-center rounded-lg bg-[#ff80ab]/20">
                  <BoxIcon color="#ff80ab" size={18} />
                </View>
                <Text className="font-jetbrains text-xs font-bold text-[#ff80ab]">Box Scanner</Text>
                <Text className={`font-jetbrains text-[8px] ${textSecondaryClass}`}>SCAN CIDS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ScanningItem' as never)}
                activeOpacity={0.8}
                className="flex-1 flex-col items-center justify-center rounded-xl border border-[#e5005c]/30 bg-[#e5005c]/10 p-3 active:bg-[#e5005c]/20">
                <View className="mb-1.5 h-8 w-8 items-center justify-center rounded-lg bg-[#e5005c]/20">
                  <Scan color="#e5005c" size={18} />
                </View>
                <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                  Item Scanner
                </Text>
                <Text className={`font-jetbrains text-[8px] ${textSecondaryClass}`}>SKU & UPC</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('DamageLostRecord' as never)}
                activeOpacity={0.8}
                className="flex-1 flex-col items-center justify-center rounded-xl border border-[#fabc4e]/30 bg-[#fabc4e]/10 p-3 active:bg-[#fabc4e]/20">
                <View className="mb-1.5 h-8 w-8 items-center justify-center rounded-lg bg-[#fabc4e]/20">
                  <FileText color="#fabc4e" size={18} />
                </View>
                <Text className="font-jetbrains text-xs font-bold text-[#fabc4e]">DLR Tool</Text>
                <Text className={`font-jetbrains text-[8px] ${textSecondaryClass}`}>
                  DAMAGE & LOSS
                </Text>
              </TouchableOpacity>
            </View>

            {/* ACTIVE SESSIONS */}
            {(savedProgress || savedItemProgress) && <SectionLabel>Active Sessions</SectionLabel>}

            {/* Active Box (CID) Session Resume Banner */}
            {savedProgress && savedProgress.total > 0 && (
              <SessionBanner
                title="Box (CID) Session"
                fileName={savedProgress.fileName}
                scanned={savedProgress.scanned}
                total={savedProgress.total}
                icon={BoxIcon}
                accent="#ff80ab"
                onResume={() => navigation.navigate('ScanningBox' as never)}
                onReset={async () => {
                  await AsyncStorage.removeItem(SCANNED_CIDS_KEY);
                  await checkProgress();
                  showToast('Box scanning progress reset', 'info');
                }}
                onClear={async () => {
                  await AsyncStorage.removeItem(MANIFEST_CIDS_KEY);
                  await AsyncStorage.removeItem(SCANNED_CIDS_KEY);
                  await AsyncStorage.removeItem(ACTIVE_BOX_FILE_KEY);
                  await checkProgress();
                  showToast('Box manifest cleared', 'info');
                }}
              />
            )}

            {/* Active Item Session Resume Banner */}
            {savedItemProgress && savedItemProgress.total > 0 && (
              <SessionBanner
                title="Item Scan Session"
                fileName={savedItemProgress.fileName}
                scanned={savedItemProgress.scanned}
                total={savedItemProgress.total}
                subtitle={
                  savedItemProgress.itemCount
                    ? `${savedItemProgress.scanned} of ${savedItemProgress.total} total units scanned across ${savedItemProgress.itemCount} item rows.`
                    : undefined
                }
                icon={Scan}
                accent="#e5005c"
                onResume={() => navigation.navigate('ScanningItem' as never)}
                onReset={async () => {
                  await AsyncStorage.removeItem(SCANNED_ITEMS_KEY);
                  await checkProgress();
                  showToast('Item scanning progress reset', 'info');
                }}
                onClear={async () => {
                  await AsyncStorage.removeItem(MANIFEST_ITEMS_KEY);
                  await AsyncStorage.removeItem(SCANNED_ITEMS_KEY);
                  await AsyncStorage.removeItem(ACTIVE_ITEM_FILE_KEY);
                  await checkProgress();
                  showToast('Item manifest cleared', 'info');
                }}
              />
            )}

            {/* MANIFEST INTAKE */}
            <SectionLabel>Manifest Intake & Upload</SectionLabel>

            {/* Step 1: Upload Box Manifest */}
            <TouchableOpacity
              onPress={handleUpload}
              disabled={isUploading}
              activeOpacity={0.8}
              className={`mb-3 flex-row items-center gap-3.5 rounded-xl border border-dashed p-4 ${cardBgClass}`}>
              <View className="h-13 w-13 items-center justify-center rounded-xl border border-[#ff80ab]/30 bg-[#ff80ab]/15">
                {isUploading ? (
                  <ActivityIndicator color="#ff80ab" size="small" />
                ) : (
                  <BoxIcon color="#ff80ab" size={24} />
                )}
              </View>
              <View className="flex-1">
                <View className="mb-0.5 flex-row items-center gap-2">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#ff80ab]">STEP 1</Text>
                  <View className="rounded border border-[#3f3f46]/50 bg-black/20 px-1.5 py-0.5">
                    <Text className="font-jetbrains text-[8px] font-bold text-[#a1a1aa]">.CSV</Text>
                  </View>
                  {savedProgress && savedProgress.total > 0 && (
                    <View className="rounded-full bg-[#ff80ab]/20 px-2 py-0.5">
                      <Text className="font-jetbrains text-[8px] font-bold text-[#ff80ab]">
                        {savedProgress.total} BOXES LOADED
                      </Text>
                    </View>
                  )}
                </View>
                <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                  Upload Box Manifest
                </Text>
                <Text
                  className={`mt-0.5 font-hanken text-[11px] ${textSecondaryClass}`}
                  numberOfLines={1}>
                  {savedProgress?.fileName
                    ? `Current: ${savedProgress.fileName}`
                    : 'CID NO, TRF NO columns · Box-level receiving'}
                </Text>
              </View>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-[#ff80ab]/15">
                {isUploading ? (
                  <ActivityIndicator color="#ff80ab" size="small" />
                ) : (
                  <ChevronRight color="#ff80ab" size={16} />
                )}
              </View>
            </TouchableOpacity>

            {/* Step 2: Upload Scanning Data */}
            <TouchableOpacity
              onPress={handleUploadScanningData}
              disabled={isUploading}
              activeOpacity={0.8}
              className={`mb-6 flex-row items-center gap-3.5 rounded-xl border border-dashed p-4 ${cardBgClass}`}>
              <View className="h-13 w-13 items-center justify-center rounded-xl border border-[#e5005c]/30 bg-[#e5005c]/15">
                {isUploading ? (
                  <ActivityIndicator color="#e5005c" size="small" />
                ) : (
                  <FileText color="#e5005c" size={24} />
                )}
              </View>
              <View className="flex-1">
                <View className="mb-0.5 flex-row items-center gap-2">
                  <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">STEP 2</Text>
                  <View className="rounded border border-[#3f3f46]/50 bg-black/20 px-1.5 py-0.5">
                    <Text className="font-jetbrains text-[8px] font-bold text-[#a1a1aa]">.CSV</Text>
                  </View>
                  {savedItemProgress && savedItemProgress.total > 0 && (
                    <View className="rounded-full bg-[#e5005c]/20 px-2 py-0.5">
                      <Text className="font-jetbrains text-[8px] font-bold text-[#e5005c]">
                        {savedItemProgress.total} TOTAL UNITS LOADED
                      </Text>
                    </View>
                  )}
                </View>
                <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                  Upload Scanning Items
                </Text>
                <Text
                  className={`mt-0.5 font-hanken text-[11px] ${textSecondaryClass}`}
                  numberOfLines={1}>
                  {savedItemProgress?.fileName
                    ? `Current: ${savedItemProgress.fileName}`
                    : 'CID · TRF · UPC · SKU · DESCRIPTION · QTY'}
                </Text>
              </View>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-[#e5005c]/15">
                {isUploading ? (
                  <ActivityIndicator color="#e5005c" size="small" />
                ) : (
                  <ChevronRight color="#e5005c" size={16} />
                )}
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* VERIFY BOX ITEMS MODE */}
      {currentMode === 'verify_items' && activeBox && (
        <View className="flex-1">
          {/* Header */}
          <View className={`flex-row items-center gap-3 border-b px-4 py-2.5 ${headerBgClass}`}>
            <TouchableOpacity onPress={() => setCurrentMode('dashboard')}>
              <ArrowLeft color={isDark ? '#fafafa' : '#18181b'} size={22} />
            </TouchableOpacity>
            <View>
              <Text className={`font-hanken text-lg font-bold ${textPrimaryClass}`}>
                Verify Box Items
              </Text>
              <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                {selectedBoxId}
              </Text>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* Box Progress Status Card */}
            <View className={`mb-4 rounded-lg border p-4 ${cardBgClass}`}>
              <View className="flex-row items-center justify-between">
                <Text
                  className={`font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
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
                <Text className={`font-hanken text-xs ${textSecondaryClass}`}>Items Scanned</Text>
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
            <Text
              className={`mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
              Expected Items Manifest
            </Text>

            {activeBox.items.map((item, idx) => {
              const isItemComplete = item.scanned === item.expected;
              return (
                <View
                  key={idx}
                  className={`mb-2 flex-row items-center justify-between rounded-lg border p-3.5 ${cardBgClass} ${
                    isItemComplete ? 'border-[#22c55e]/50' : ''
                  }`}>
                  <View className="mr-2 flex-1">
                    <Text
                      className={`font-mono text-xs font-bold tracking-wider ${textPrimaryClass}`}>
                      {item.sku}
                    </Text>
                    <Text className={`mt-0.5 font-hanken text-[10px] ${textSecondaryClass}`}>
                      {item.desc}
                    </Text>
                  </View>
                  <View
                    className={`flex-row items-center gap-2 rounded border px-3 py-1 ${
                      isItemComplete ? 'border-[#22c55e] bg-[#22c55e]/15' : innerCardBgClass
                    }`}>
                    {isItemComplete && <Check color="#22c55e" size={12} />}
                    <Text
                      className={`font-jetbrains text-[10px] font-bold ${
                        isItemComplete ? 'text-[#22c55e]' : textPrimaryClass
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
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                autoCapitalize="characters"
                className={`h-11 flex-1 rounded-lg border px-3 py-2 font-jetbrains text-sm ${innerCardBgClass} ${textPrimaryClass}`}
              />
              <TouchableOpacity
                onPress={() => handleScanItem(manualItemId)}
                className="h-11 items-center justify-center rounded-lg bg-[#e5005c] px-5">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">SCAN</Text>
              </TouchableOpacity>
            </View>

            {/* Simulation triggers for items */}
            <View className="mb-8 mt-6">
              <Text
                className={`mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                Simulated Barcode Scanner
              </Text>

              {activeBox.items.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleScanItem(item.sku)}
                  className={`mb-2 flex-row items-center justify-between rounded-lg border p-3 ${innerCardBgClass}`}>
                  <View className="flex-row items-center gap-3">
                    <Scan color="#e5005c" size={16} />
                    <View>
                      <Text className={`font-hanken text-xs font-semibold ${textPrimaryClass}`}>
                        Scan Barcode: {item.sku}
                      </Text>
                      <Text className={`font-hanken text-[9px] ${textSecondaryClass}`}>
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
                className={`flex-row items-center justify-between rounded-lg border p-3 ${innerCardBgClass}`}>
                <View className="flex-row items-center gap-3">
                  <Scan color="#ef4444" size={16} />
                  <View>
                    <Text className={`font-hanken text-xs font-semibold ${textPrimaryClass}`}>
                      Scan Unexpected Barcode
                    </Text>
                    <Text className={`font-hanken text-[9px] ${textSecondaryClass}`}>
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
