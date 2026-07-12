import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { ArrowLeft, Keyboard, CheckCircle, X, AlertTriangle } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MANIFEST_CIDS_KEY } from './one';

export default function ScanningBoxScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'unscanned' | 'scanned'>('unscanned');
  const [unscannedBoxes, setUnscannedBoxes] = useState<string[]>([]);
  const [scannedBoxes, setScannedBoxes] = useState<string[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Debounce: prevent the same barcode from firing twice in quick succession
  const scanCooldown = useRef(false);

  // Animated laser sweep
  const laserAnim = useRef(new Animated.Value(0)).current;
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

  // Reload manifest from AsyncStorage every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadManifest = async () => {
        try {
          const stored = await AsyncStorage.getItem(MANIFEST_CIDS_KEY);
          if (stored) {
            const allCids = JSON.parse(stored) as string[];
            setUnscannedBoxes((prev) => {
              const alreadyScanned = new Set(prev.length === 0 ? scannedBoxes : []);
              return allCids.filter((c) => !alreadyScanned.has(c));
            });
          }
        } catch {
          // Storage read failed — leave list as-is
        }
      };
      loadManifest();
    }, [])
  );

  const totalBoxes = unscannedBoxes.length + scannedBoxes.length;
  const progressPct = totalBoxes > 0 ? Math.round((scannedBoxes.length / totalBoxes) * 100) : 0;

  /** Move a CID from unscanned → scanned */
  const handleScan = useCallback((cid: string) => {
    const trimmed = cid.trim();
    setUnscannedBoxes((prev) => {
      if (!prev.includes(trimmed)) return prev; // not in manifest — ignore
      return prev.filter((c) => c !== trimmed);
    });
    setScannedBoxes((prev) => {
      if (prev.includes(trimmed)) return prev; // already scanned
      return [trimmed, ...prev];
    });
    setLastScanned(trimmed);
    setTimeout(() => setLastScanned(null), 2500);
  }, []);

  /** Called by CameraView when a barcode/QR is detected */
  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (scanCooldown.current) return;
      scanCooldown.current = true;
      setTimeout(() => {
        scanCooldown.current = false;
      }, 1500);
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

      {/* Camera Area */}
      <View className="relative h-[40%] overflow-hidden bg-black">
        {!permission ? (
          // Permissions loading
          <View className="flex-1 items-center justify-center">
            <Text className="font-hanken text-sm text-[#a1a1aa]">Requesting camera...</Text>
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
            <View className="absolute left-8 top-10 h-12 w-12 border-l-[3px] border-t-[3px] border-[#ff80ab]" />
            <View className="absolute right-8 top-10 h-12 w-12 border-r-[3px] border-t-[3px] border-[#ff80ab]" />
            <View className="absolute bottom-14 left-8 h-12 w-12 border-b-[3px] border-l-[3px] border-[#ff80ab]" />
            <View className="absolute bottom-14 right-8 h-12 w-12 border-b-[3px] border-r-[3px] border-[#ff80ab]" />

            {/* Animated Laser Line */}
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
                      outputRange: [35, 280],
                    }),
                  },
                ],
              }}
            />

            {/* Manual Entry Button */}
            <TouchableOpacity
              onPress={() => setShowManual(true)}
              className="absolute bottom-4 right-4 flex-row items-center gap-2 rounded-lg border border-[#3f3f46] bg-[#2a2a2d]/90 px-4 py-2.5">
              <Keyboard color="#ffb2c3" size={16} />
              <Text className="font-jetbrains text-xs font-bold text-[#ffb2c3]">MANUAL ENTRY</Text>
            </TouchableOpacity>
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
