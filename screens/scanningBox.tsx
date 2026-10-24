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
  Image,
  ScrollView,
  Platform,
  AppState,
  Linking,
  StyleSheet,
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
  Package,
  Search,
  FileText,
  Box as BoxIcon,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react-native';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Papa from 'papaparse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/theme';
import {
  MANIFEST_CIDS_KEY,
  SCANNED_CIDS_KEY,
  MANIFEST_ITEMS_KEY,
  SCANNED_ITEMS_KEY,
  UPLOADED_ITEM_IMAGES_KEY,
  ACTIVE_ITEM_FILE_KEY,
  saveSessionToHistory,
  type BoxManifestRecord,
  type ItemManifestRecord,
} from '../utils/storage';

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

/**
 * Strips leading zeros and invisible control characters before comparing
 * TRF NO / SKU / UPC codes (e.g. "002311699" -> "2311699").
 */
function normalizeLookupCode(value?: string | null): string {
  const cleaned = (value || '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase();
  if (!cleaned) return '';
  return cleaned.replace(/^0+/, '') || '0';
}

function getItemImageKey(item: ItemManifestRecord): string {
  const upc = (item.upc || '').trim();
  if (upc) return `upc:${upc}`;
  const sku = (item.sku || '').trim();
  if (sku) return `sku:${sku}`;
  return `id:${item.id}`;
}

const failedItemImagesCache = new Set<string>();

interface ItemImagePreviewPayload {
  item: ItemManifestRecord;
  thumbnailUrl: string;
  highResUrl: string;
}

function TrfLookupItemCard({
  item,
  isDark,
  textPrimaryClass,
  textSecondaryClass,
  uploadedImageUrl,
  scannedQty,
  expectedQty,
  onOpenSearchInBrowser,
  onPressPreviewImage,
}: {
  item: ItemManifestRecord;
  isDark: boolean;
  textPrimaryClass: string;
  textSecondaryClass: string;
  uploadedImageUrl?: string;
  scannedQty: number;
  expectedQty: number;
  onOpenSearchInBrowser: (item: ItemManifestRecord) => void;
  onPressPreviewImage: (payload: ItemImagePreviewPayload) => void;
}) {
  const cleanUpc = (item.upc || '').trim();
  const [triedBackupUpc, setTriedBackupUpc] = useState<string | null>(null);
  const [failedUpc, setFailedUpc] = useState<string | null>(() =>
    cleanUpc && failedItemImagesCache.has(cleanUpc) ? cleanUpc : null
  );
  const [failedUploadedUri, setFailedUploadedUri] = useState<string | null>(null);

  const activeUploadedUrl =
    uploadedImageUrl && failedUploadedUri !== uploadedImageUrl ? uploadedImageUrl : undefined;

  // An image is missing if:
  // 1) There is no active uploaded URL, AND
  // 2) Either there is no clean UPC at all, or the UPC failed both Daiso and Cloudinary CDN lookups
  const isImageMissing =
    !activeUploadedUrl &&
    (!cleanUpc || failedUpc === cleanUpc || failedItemImagesCache.has(cleanUpc));
  const isImageAvailable = !isImageMissing;

  const isComplete = scannedQty >= expectedQty && expectedQty > 0;
  const isPartial = scannedQty > 0 && scannedQty < expectedQty;

  const isUsingBackup = triedBackupUpc === cleanUpc;
  const imageUrl = activeUploadedUrl
    ? activeUploadedUrl
    : isUsingBackup
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/products/${cleanUpc}`
      : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_400x.jpg`;

  const highResUrl = activeUploadedUrl
    ? activeUploadedUrl
    : isUsingBackup
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/products/${cleanUpc}`
      : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_1000x.jpg`;

  const handleImageError = () => {
    if (activeUploadedUrl) {
      setFailedUploadedUri(activeUploadedUrl);
    } else if (!isUsingBackup) {
      setTriedBackupUpc(cleanUpc);
    } else {
      if (cleanUpc) {
        failedItemImagesCache.add(cleanUpc);
      }
      setFailedUpc(cleanUpc);
    }
  };

  const handleCardPress = () => {
    if (isImageAvailable) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onPressPreviewImage({
        item,
        thumbnailUrl: imageUrl,
        highResUrl,
      });
    } else {
      onOpenSearchInBrowser(item);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handleCardPress}
      className={`mb-2.5 flex-row items-center gap-3 rounded-xl border p-3 ${
        isComplete
          ? 'border-[#22c55e]/40 bg-[#22c55e]/5'
          : isDark
            ? 'border-[#3f3f46] bg-[#1f1f22]'
            : 'border-[#e4e4e7] bg-[#ffffff]'
      }`}>
      {/* Thumbnail or Package Placeholder */}
      {isImageMissing ? (
        <View
          className={`h-16 w-16 items-center justify-center rounded-lg border ${
            isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
          }`}>
          <Package color={isDark ? '#52525b' : '#a1a1aa'} size={20} />
        </View>
      ) : (
        <View
          className={`relative h-16 w-16 overflow-hidden rounded-lg border ${
            isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={handleImageError}
          />
          <View className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5">
            <ZoomIn color="#ffffff" size={9} />
          </View>
        </View>
      )}

      {/* Item Details */}
      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-1">
          <Text
            className={`flex-1 font-hanken text-xs font-bold leading-4 ${textPrimaryClass}`}
            numberOfLines={2}>
            {item.description || 'Unnamed Item'}
          </Text>
          {/* Expo Web Browser Search Button: only visible if image is NOT available */}
          {!isImageAvailable && (
            <View
              className={`flex-row items-center gap-1 rounded border px-1.5 py-0.5 ${
                isDark
                  ? 'border-[#ff80ab]/40 bg-[#ff80ab]/10'
                  : 'border-[#e5005c]/30 bg-[#e5005c]/10'
              }`}>
              <ExternalLink color={isDark ? '#ff80ab' : '#e5005c'} size={11} />
              <Text
                className={`font-jetbrains text-[9px] font-bold ${
                  isDark ? 'text-[#ff80ab]' : 'text-[#e5005c]'
                }`}>
                SEARCH
              </Text>
            </View>
          )}
        </View>

        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          <View
            className={`rounded border px-1.5 py-0.5 ${
              isDark ? 'border-[#ff80ab]/30 bg-[#ff80ab]/10' : 'border-[#e5005c]/30 bg-[#e5005c]/10'
            }`}>
            <Text
              className={`font-jetbrains text-[10px] font-bold ${
                isDark ? 'text-[#ff80ab]' : 'text-[#e5005c]'
              }`}>
              SKU: {item.sku || '—'}
            </Text>
          </View>

          <View
            className={`rounded border px-1.5 py-0.5 ${
              isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            <Text className={`font-jetbrains text-[10px] font-semibold ${textSecondaryClass}`}>
              UPC: {item.upc || '—'}
            </Text>
          </View>
        </View>

        <Text className={`mt-1 font-jetbrains text-[10px] ${textSecondaryClass}`} numberOfLines={1}>
          TRF: {item.trf || '—'}
          {item.cid ? `  •  CID: ${item.cid}` : ''}
        </Text>
      </View>

      {/* Scanned / Total QTY */}
      <View className="items-end justify-center pl-1">
        <View
          className={`items-center justify-center rounded-lg border px-2.5 py-1.5 ${
            isComplete
              ? 'border-[#22c55e]/50 bg-[#22c55e]/15'
              : isPartial
                ? 'border-[#eab308]/50 bg-[#eab308]/15'
                : isDark
                  ? 'border-[#3f3f46] bg-[#131316]'
                  : 'border-[#e4e4e7] bg-[#f4f4f5]'
          }`}>
          <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
            {scannedQty > 0 ? 'SCANNED' : 'QTY'}
          </Text>
          <Text
            className={`font-jetbrains text-sm font-extrabold ${
              isComplete ? 'text-[#22c55e]' : isPartial ? 'text-[#eab308]' : 'text-[#ff80ab]'
            }`}>
            {scannedQty > 0 ? `${scannedQty}/${expectedQty}` : expectedQty}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ItemImageZoomModalContent({
  data,
  isDark,
  scannedQty,
  onClose,
}: {
  data: ItemImagePreviewPayload;
  isDark: boolean;
  scannedQty: number;
  onClose: () => void;
}) {
  const { item, thumbnailUrl, highResUrl } = data;
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';
  const subCardBgClass = isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#fafafa]';

  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loadedHighResUri, setLoadedHighResUri] = useState<string | null>(null);
  const [failedHighResUri, setFailedHighResUri] = useState<string | null>(null);

  const zoomScaleRef = useRef<number>(1);
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewportSizeRef = useRef<{ width: number; height: number }>({ width: 320, height: 288 });
  const gestureStartRef = useRef({
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
    pinchDist: 0,
    startScale: 1,
    moved: false,
  });
  const lastTapTimeRef = useRef<number>(0);

  const clampPan = useCallback((x: number, y: number, scale: number) => {
    if (scale <= 1) return { x: 0, y: 0 };
    const maxX = (viewportSizeRef.current.width * (scale - 1)) / 2;
    const maxY = (viewportSizeRef.current.height * (scale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const applyZoom = useCallback(
    (nextScale: number, nextPan?: { x: number; y: number }) => {
      const clampedScale = Math.min(4, Math.max(1, Math.round(nextScale * 100) / 100));
      const targetPan =
        clampedScale <= 1
          ? { x: 0, y: 0 }
          : clampPan(
              nextPan ? nextPan.x : panOffsetRef.current.x,
              nextPan ? nextPan.y : panOffsetRef.current.y,
              clampedScale
            );
      zoomScaleRef.current = clampedScale;
      panOffsetRef.current = targetPan;
      setZoomScale(clampedScale);
      setPanOffset(targetPan);
    },
    [clampPan]
  );

  const handleResponderGrant = useCallback((evt: any) => {
    const touches = evt.nativeEvent.touches || [];
    gestureStartRef.current.moved = false;
    gestureStartRef.current.startX = evt.nativeEvent.pageX || 0;
    gestureStartRef.current.startY = evt.nativeEvent.pageY || 0;
    gestureStartRef.current.panX = panOffsetRef.current.x;
    gestureStartRef.current.panY = panOffsetRef.current.y;
    gestureStartRef.current.startScale = zoomScaleRef.current;

    if (touches.length >= 2) {
      gestureStartRef.current.pinchDist = Math.hypot(
        touches[1].pageX - touches[0].pageX,
        touches[1].pageY - touches[0].pageY
      );
    } else {
      gestureStartRef.current.pinchDist = 0;
    }
  }, []);

  const handleResponderMove = useCallback(
    (evt: any) => {
      const touches = evt.nativeEvent.touches || [];
      if (touches.length >= 2) {
        gestureStartRef.current.moved = true;
        const dist = Math.hypot(
          touches[1].pageX - touches[0].pageX,
          touches[1].pageY - touches[0].pageY
        );
        if (gestureStartRef.current.pinchDist === 0) {
          gestureStartRef.current.pinchDist = dist;
          gestureStartRef.current.startScale = zoomScaleRef.current;
        } else if (dist > 0) {
          const nextScale =
            gestureStartRef.current.startScale * (dist / gestureStartRef.current.pinchDist);
          applyZoom(nextScale);
        }
      } else if (zoomScaleRef.current > 1) {
        const dx = (evt.nativeEvent.pageX || 0) - gestureStartRef.current.startX;
        const dy = (evt.nativeEvent.pageY || 0) - gestureStartRef.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          gestureStartRef.current.moved = true;
        }
        applyZoom(zoomScaleRef.current, {
          x: gestureStartRef.current.panX + dx,
          y: gestureStartRef.current.panY + dy,
        });
      }
    },
    [applyZoom]
  );

  const handleResponderRelease = useCallback(() => {
    if (!gestureStartRef.current.moved) {
      const now = Date.now();
      if (lastTapTimeRef.current > 0 && now - lastTapTimeRef.current < 320) {
        lastTapTimeRef.current = 0;
        const targetScale = zoomScaleRef.current > 1 ? 1 : 2.5;
        applyZoom(targetScale, { x: 0, y: 0 });
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      } else {
        lastTapTimeRef.current = now;
      }
    }
  }, [applyZoom]);

  const expectedQty = item.qty || 0;
  const isOverScanned = scannedQty > expectedQty;
  const isFulfilled = scannedQty === expectedQty && expectedQty > 0;
  const isShort = scannedQty > 0 && scannedQty < expectedQty;
  const overageAmount = Math.max(0, scannedQty - expectedQty);
  const remainingQty = Math.max(0, expectedQty - scannedQty);

  const showHighRes = highResUrl !== thumbnailUrl && failedHighResUri !== highResUrl;
  const isHighResReady = loadedHighResUri === highResUrl;

  return (
    <View className="flex-1 items-center justify-center bg-black/85 px-4 py-6">
      {/* Tap outside modal card to close */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View
        className={`max-h-[92%] w-full max-w-md overflow-hidden rounded-xl border shadow-2xl ${
          isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
        }`}>
        {/* Modal Header */}
        <View
          className={`flex-row items-center justify-between border-b px-4 py-3 ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          <View className="flex-1 flex-row items-center gap-2 pr-2">
            <View className="rounded-lg bg-[#e5005c]/15 p-1.5">
              <ZoomIn color="#e5005c" size={16} />
            </View>
            <View className="flex-1">
              <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                Item Image Preview
              </Text>
              <Text
                className={`font-jetbrains text-[10px] ${textSecondaryClass}`}
                numberOfLines={1}>
                {item.sku ? `SKU: ${item.sku}` : item.upc ? `UPC: ${item.upc}` : 'Product Details'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className={`rounded-lg border p-1.5 ${
              isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            <X color={isDark ? '#fafafa' : '#18181b'} size={18} />
          </TouchableOpacity>
        </View>

        {/* Enlarged & Interactive Zoomable Image Viewport */}
        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              viewportSizeRef.current = { width, height };
            }
          }}
          className={`relative h-72 w-full overflow-hidden border-b bg-white ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={(evt) =>
              (evt.nativeEvent.touches?.length || 0) >= 2 || zoomScaleRef.current > 1
            }
            onResponderGrant={handleResponderGrant}
            onResponderMove={handleResponderMove}
            onResponderRelease={handleResponderRelease}
            className="h-full w-full items-center justify-center">
            <View
              style={{
                width: '100%',
                height: '100%',
                transform: [
                  { translateX: panOffset.x },
                  { translateY: panOffset.y },
                  { scale: zoomScale },
                ],
              }}>
              <Image
                source={{ uri: thumbnailUrl }}
                resizeMode="contain"
                className="h-full w-full p-3"
              />
              {showHighRes && (
                <Image
                  key={highResUrl}
                  source={{ uri: highResUrl }}
                  resizeMode="contain"
                  onLoad={() => setLoadedHighResUri(highResUrl)}
                  onError={() => setFailedHighResUri(highResUrl)}
                  className="h-full w-full p-3"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    opacity: isHighResReady ? 1 : 0,
                  }}
                />
              )}
            </View>
          </View>

          {/* Zoom Controls Overlay */}
          <View
            pointerEvents="box-none"
            className="absolute bottom-2.5 left-2.5 right-2.5 flex-row items-center justify-between">
            <View pointerEvents="none" className="rounded-md bg-black/65 px-2 py-1">
              <Text className="font-jetbrains text-[9px] font-semibold text-[#ffffff]">
                {zoomScale > 1 ? 'Drag to pan · Double-tap reset' : 'Pinch or double-tap to zoom'}
              </Text>
            </View>

            <View className="flex-row items-center gap-1 rounded-lg bg-black/80 p-1">
              <TouchableOpacity
                onPress={() => {
                  applyZoom(zoomScale - 0.5);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }}
                disabled={zoomScale <= 1}
                className={`h-7 w-7 items-center justify-center rounded ${
                  zoomScale <= 1 ? 'opacity-40' : 'active:bg-white/20'
                }`}>
                <ZoomOut color="#ffffff" size={14} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const nextPreset = zoomScale < 2 ? 2 : zoomScale < 3 ? 3 : 1;
                  applyZoom(nextPreset, nextPreset === 1 ? { x: 0, y: 0 } : undefined);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }}
                className="rounded bg-white/15 px-2 py-1">
                <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
                  {zoomScale.toFixed(1)}x
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  applyZoom(zoomScale + 0.5);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }}
                disabled={zoomScale >= 4}
                className={`h-7 w-7 items-center justify-center rounded ${
                  zoomScale >= 4 ? 'opacity-40' : 'active:bg-white/20'
                }`}>
                <ZoomIn color="#ffffff" size={14} />
              </TouchableOpacity>

              {zoomScale > 1 && (
                <TouchableOpacity
                  onPress={() => {
                    applyZoom(1, { x: 0, y: 0 });
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                  }}
                  className="ml-0.5 h-7 w-7 items-center justify-center rounded bg-[#e5005c]">
                  <RotateCcw color="#ffffff" size={13} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Item Details Below the Enlarged Image */}
        <ScrollView className="max-h-72 px-4 pt-3.5" showsVerticalScrollIndicator={false}>
          {/* Status Pills */}
          <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
            {isOverScanned ? (
              <View className="flex-row items-center gap-1 rounded border border-[#ef4444]/40 bg-[#ef4444]/15 px-2 py-0.5">
                <AlertTriangle color="#ef4444" size={12} />
                <Text className="font-jetbrains text-[10px] font-bold text-[#ef4444]">
                  OVER-SCANNED (+{overageAmount})
                </Text>
              </View>
            ) : isFulfilled ? (
              <View className="flex-row items-center gap-1 rounded border border-[#22c55e]/40 bg-[#22c55e]/15 px-2 py-0.5">
                <CheckCircle color="#22c55e" size={12} />
                <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                  FULFILLED
                </Text>
              </View>
            ) : isShort ? (
              <View className="flex-row items-center gap-1 rounded border border-[#eab308]/40 bg-[#eab308]/15 px-2 py-0.5">
                <AlertTriangle color="#eab308" size={12} />
                <Text className="font-jetbrains text-[10px] font-bold text-[#eab308]">
                  SHORT (-{remainingQty})
                </Text>
              </View>
            ) : (
              <View
                className={`rounded border px-2 py-0.5 ${
                  isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                }`}>
                <Text className={`font-jetbrains text-[10px] font-bold ${textSecondaryClass}`}>
                  UNSCANNED
                </Text>
              </View>
            )}
          </View>

          {/* Full Item Description */}
          <Text className={`mb-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
            {item.description || 'No description available'}
          </Text>

          {/* 2-Column Technical Identifiers Grid */}
          <View className="mb-3 flex-row flex-wrap gap-2">
            <View className={`min-w-[47%] flex-1 rounded-lg border p-2.5 ${subCardBgClass}`}>
              <Text
                className={`font-jetbrains text-[9px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                SKU
              </Text>
              <Text
                className={`mt-0.5 font-jetbrains text-xs font-bold ${textPrimaryClass}`}
                selectable>
                {item.sku || '—'}
              </Text>
            </View>

            <View className={`min-w-[47%] flex-1 rounded-lg border p-2.5 ${subCardBgClass}`}>
              <Text
                className={`font-jetbrains text-[9px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                UPC
              </Text>
              <Text className="mt-0.5 font-jetbrains text-xs font-bold text-[#e5005c]" selectable>
                {item.upc || '—'}
              </Text>
            </View>

            <View className={`min-w-[47%] flex-1 rounded-lg border p-2.5 ${subCardBgClass}`}>
              <Text
                className={`font-jetbrains text-[9px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                BOX CID
              </Text>
              <Text
                className={`mt-0.5 font-jetbrains text-xs font-semibold ${textPrimaryClass}`}
                selectable>
                {item.cid || '—'}
              </Text>
            </View>

            <View className={`min-w-[47%] flex-1 rounded-lg border p-2.5 ${subCardBgClass}`}>
              <Text
                className={`font-jetbrains text-[9px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                TRF NO
              </Text>
              <Text
                className={`mt-0.5 font-jetbrains text-xs font-semibold ${textPrimaryClass}`}
                selectable>
                {item.trf || '—'}
              </Text>
            </View>
          </View>

          {/* Quantity Breakdown Row */}
          <View className="mb-3 flex-row items-center gap-2">
            <View className={`flex-1 items-center rounded-lg border py-2 ${subCardBgClass}`}>
              <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
                MANIFEST QTY
              </Text>
              <Text className={`mt-0.5 font-jetbrains text-sm font-bold ${textPrimaryClass}`}>
                {expectedQty}
              </Text>
            </View>

            <View className={`flex-1 items-center rounded-lg border py-2 ${subCardBgClass}`}>
              <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
                SCANNED QTY
              </Text>
              <Text
                className={`mt-0.5 font-jetbrains text-sm font-bold ${
                  isOverScanned
                    ? 'text-[#ef4444]'
                    : isFulfilled
                      ? 'text-[#22c55e]'
                      : scannedQty > 0
                        ? 'text-[#e5005c]'
                        : textPrimaryClass
                }`}>
                {scannedQty}
              </Text>
            </View>

            <View className={`flex-1 items-center rounded-lg border py-2 ${subCardBgClass}`}>
              <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
                {isOverScanned ? 'OVERAGE' : 'REMAINING'}
              </Text>
              <Text
                className={`mt-0.5 font-jetbrains text-sm font-bold ${
                  isOverScanned
                    ? 'text-[#ef4444]'
                    : remainingQty > 0
                      ? 'text-[#eab308]'
                      : 'text-[#22c55e]'
                }`}>
                {isOverScanned ? `+${overageAmount}` : remainingQty}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Modal Footer Actions */}
        <View
          className={`flex-row items-center gap-2.5 border-t px-4 py-3 ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          <TouchableOpacity
            key="close-btn"
            onPress={onClose}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center rounded-lg border py-3 ${
              isDark
                ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
            }`}>
            <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ScanningBoxScreen({
  navigation: propNavigation,
}: { navigation?: any } = {}) {
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

  // Uploaded Scanning Items manifest CSV data & TRF NO lookup modal state
  const [manifestItems, setManifestItems] = useState<ItemManifestRecord[]>([]);
  const [scannedItemsMap, setScannedItemsMap] = useState<Record<string, number>>({});
  const [uploadedItemImages, setUploadedItemImages] = useState<Record<string, string>>({});
  const [activeItemFileName, setActiveItemFileName] = useState<string | null>(null);
  const [showTrfLookupModal, setShowTrfLookupModal] = useState(false);
  const [imageZoomModal, setImageZoomModal] = useState<ItemImagePreviewPayload | null>(null);
  const [trfLookupBox, setTrfLookupBox] = useState<BoxManifestRecord | null>(null);
  const [trfLookupQuery, setTrfLookupQuery] = useState('');
  const [trfItemSearchQuery, setTrfItemSearchQuery] = useState('');
  const [isUploadingItemsCsv, setIsUploadingItemsCsv] = useState(false);

  // Screen focus, CameraX handoff lifecycle & fast swipe/tab switch to ScanningItemScreen
  const boxCameraRef = useRef<CameraView | null>(null);
  const wasBlurredRef = useRef(false);
  const cameraRetryCountRef = useRef(0);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [isBoxCameraReady, setIsBoxCameraReady] = useState(false);
  const [isSwitchingToItems, setIsSwitchingToItems] = useState(false);
  const [isSwipingLeftHint, setIsSwipingLeftHint] = useState(false);
  const [swipeTranslateX] = useState(() => new Animated.Value(0));

  // Full screen tabs mode (covers camera when swiped up)
  const [isFullScreenTabs, setIsFullScreenTabs] = useState(false);
  const [isBluetoothScannerActive, setIsBluetoothScannerActive] = useState(false);
  const [bluetoothInput, setBluetoothInput] = useState('');
  const bluetoothInputRef = useRef<TextInput>(null);
  const liveBufferRef = useRef('');
  const scanBufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const toggleBluetoothScanner = useCallback(() => {
    setIsBluetoothScannerActive((prev) => {
      const next = !prev;
      if (!next) {
        if (scanBufferTimerRef.current) {
          clearTimeout(scanBufferTimerRef.current);
          scanBufferTimerRef.current = null;
        }
        setIsBuffering(false);
        liveBufferRef.current = '';
        setBluetoothInput('');
        bluetoothInputRef.current?.blur();
      }
      return next;
    });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }, []);

  const refocusBluetoothInput = useCallback(() => {
    if (
      isFullScreenTabs &&
      isBluetoothScannerActive &&
      !showTrfLookupModal &&
      !showManual &&
      !confirmCidModal
    ) {
      setTimeout(() => {
        bluetoothInputRef.current?.focus();
      }, 150);
    }
  }, [isFullScreenTabs, isBluetoothScannerActive, showTrfLookupModal, showManual, confirmCidModal]);

  // Focus bluetooth input automatically only when swiped up AND Bluetooth scanner toggle is active
  useEffect(() => {
    if (
      isFullScreenTabs &&
      isBluetoothScannerActive &&
      !showTrfLookupModal &&
      !showManual &&
      !confirmCidModal
    ) {
      const focusTimer = setTimeout(() => {
        bluetoothInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
    }
  }, [isFullScreenTabs, isBluetoothScannerActive, showTrfLookupModal, showManual, confirmCidModal]);

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

  // Reload box manifest, scanned CIDs, and uploaded Scanning Items manifest CSV on focus
  const loadSavedProgress = useCallback(async () => {
    try {
      const [
        storedManifest,
        storedScanned,
        storedItemsManifest,
        storedScannedItems,
        storedUploadedImages,
        storedActiveItemFile,
      ] = await Promise.all([
        AsyncStorage.getItem(MANIFEST_CIDS_KEY),
        AsyncStorage.getItem(SCANNED_CIDS_KEY),
        AsyncStorage.getItem(MANIFEST_ITEMS_KEY),
        AsyncStorage.getItem(SCANNED_ITEMS_KEY),
        AsyncStorage.getItem(UPLOADED_ITEM_IMAGES_KEY),
        AsyncStorage.getItem(ACTIVE_ITEM_FILE_KEY),
      ]);

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

      if (storedItemsManifest) {
        const parsedItems = JSON.parse(storedItemsManifest) as ItemManifestRecord[];
        setManifestItems(Array.isArray(parsedItems) ? parsedItems : []);
      } else {
        setManifestItems([]);
      }

      if (storedScannedItems) {
        const parsedScannedItems = JSON.parse(storedScannedItems) as Record<string, number>;
        setScannedItemsMap(
          parsedScannedItems && typeof parsedScannedItems === 'object' ? parsedScannedItems : {}
        );
      } else {
        setScannedItemsMap({});
      }

      if (storedUploadedImages) {
        const parsedImages = JSON.parse(storedUploadedImages) as Record<string, string>;
        setUploadedItemImages(parsedImages && typeof parsedImages === 'object' ? parsedImages : {});
      } else {
        setUploadedItemImages({});
      }

      setActiveItemFileName(storedActiveItemFile || null);
    } catch {
      // Storage read failed — leave list as-is
    }
  }, []);

  // Cleanly unmount & remount CameraView with a gap so old ExpoCameraView.cleanupCamera()
  // finishes cameraProvider.unbindAll() BEFORE the new ExpoCameraView binds!
  const remountBoxCameraWithGap = useCallback(() => {
    setIsCameraActive(false);
    setIsBoxCameraReady(false);
    setTimeout(() => {
      setCameraSessionKey((prev) => prev + 1);
      setIsCameraActive(true);
    }, 350);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      let remountTimer: ReturnType<typeof setTimeout> | null = null;

      setIsSwitchingToItems(false);
      setIsSwipingLeftHint(false);
      swipeTranslateX.setValue(0);
      loadSavedProgress();

      const mountFreshCamera = () => {
        if (isCancelled) return;
        cameraRetryCountRef.current = 0;
        setIsBoxCameraReady(false);
        setCameraSessionKey((prev) => prev + 1);
        setIsCameraActive(true);
      };

      // When returning from ScanningItemScreen, wait until the closing stack card finishes
      // unmounting and running ExpoCameraView.cleanupCamera() (cameraProvider.unbindAll()) first!
      if (!wasBlurredRef.current) {
        setIsCameraActive(true);
      } else {
        setIsCameraActive(false);
        setIsBoxCameraReady(false);
        remountTimer = setTimeout(mountFreshCamera, 700);
      }

      // If stack transitionEnd fires (e.g. hardware/header back pop), mount strictly 250ms after it finishes
      const unsubscribeTransitionEnd =
        wasBlurredRef.current && typeof navigation?.addListener === 'function'
          ? navigation.addListener('transitionEnd', (e: { data?: { closing?: boolean } }) => {
              if (isCancelled || e?.data?.closing) return;
              if (remountTimer) {
                clearTimeout(remountTimer);
              }
              remountTimer = setTimeout(mountFreshCamera, 250);
            })
          : undefined;

      return () => {
        isCancelled = true;
        wasBlurredRef.current = true;
        if (remountTimer) {
          clearTimeout(remountTimer);
        }
        if (typeof unsubscribeTransitionEnd === 'function') {
          unsubscribeTransitionEnd();
        }
        setIsCameraActive(false);
        setIsBoxCameraReady(false);
        setIsHoldScanning(false);
      };
    }, [loadSavedProgress, navigation, swipeTranslateX])
  );

  // Nudge Android CameraX preview & self-heal if singleton ProcessCameraProvider was unbound during transition
  useEffect(() => {
    if (
      !isCameraActive ||
      isFullScreenTabs ||
      !permission?.granted ||
      isBoxCameraReady ||
      Platform.OS === 'web'
    ) {
      return;
    }

    const resumeTimer1 = setTimeout(() => {
      try {
        boxCameraRef.current?.resumePreview()?.catch(() => {});
      } catch {}
    }, 350);

    const resumeTimer2 = setTimeout(() => {
      try {
        boxCameraRef.current?.resumePreview()?.catch(() => {});
      } catch {}
    }, 850);

    const watchdogTimer = setTimeout(() => {
      if (cameraRetryCountRef.current < 2) {
        cameraRetryCountRef.current += 1;
        remountBoxCameraWithGap();
      }
    }, 1800);

    return () => {
      clearTimeout(resumeTimer1);
      clearTimeout(resumeTimer2);
      clearTimeout(watchdogTimer);
    };
  }, [
    isCameraActive,
    cameraSessionKey,
    isFullScreenTabs,
    permission?.granted,
    isBoxCameraReady,
    remountBoxCameraWithGap,
  ]);

  // Recover camera session cleanly when returning from OS background
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (
        prevState.match(/inactive|background/) &&
        nextState === 'active' &&
        !isFullScreenTabs &&
        !isSwitchingToItems
      ) {
        cameraRetryCountRef.current = 0;
        remountBoxCameraWithGap();
      }
    });
    return () => {
      sub.remove();
    };
  }, [isFullScreenTabs, isSwitchingToItems, remountBoxCameraWithGap]);

  // Fast navigation to Item Scanner (unmounts Box CameraView first to prevent camera contention)
  const navigateToItemScanner = useCallback(() => {
    if (!navigation || isSwitchingToItems) return;
    setIsSwitchingToItems(true);
    setIsSwipingLeftHint(false);
    setIsHoldScanning(false);
    setIsBoxCameraReady(false);
    setIsCameraActive(false);
    swipeTranslateX.setValue(0);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setTimeout(() => {
      navigation.navigate('ScanningItem' as never);
    }, 220);
  }, [navigation, isSwitchingToItems, swipeTranslateX]);

  // Horizontal swipe-left gesture across ScanningBoxScreen to switch quickly to ScanningItemScreen
  const screenSwipePanResponder = useMemo(() => {
    const shouldCaptureHorizontalSwipe = (gestureState: { dx: number; dy: number }) => {
      if (
        showTrfLookupModal ||
        showManual ||
        confirmCidModal !== null ||
        isHoldScanning ||
        isSwitchingToItems
      ) {
        return false;
      }
      return gestureState.dx < -20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => shouldCaptureHorizontalSwipe(gestureState),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        shouldCaptureHorizontalSwipe(gestureState),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const clamped = Math.max(-88, gestureState.dx * 0.35);
          swipeTranslateX.setValue(clamped);
          setIsSwipingLeftHint(gestureState.dx < -55);
        } else {
          swipeTranslateX.setValue(0);
          setIsSwipingLeftHint(false);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldSwitch =
          gestureState.dx < -65 || (gestureState.dx < -35 && gestureState.vx < -0.45);
        setIsSwipingLeftHint(false);
        if (shouldSwitch) {
          navigateToItemScanner();
        } else {
          Animated.spring(swipeTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setIsSwipingLeftHint(false);
        Animated.spring(swipeTranslateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
      },
    });
  }, [
    showTrfLookupModal,
    showManual,
    confirmCidModal,
    isHoldScanning,
    isSwitchingToItems,
    swipeTranslateX,
    navigateToItemScanner,
  ]);

  // O(1) index of Scanning Items manifest records grouped by normalized TRF NO
  const itemsByTrfMap = useMemo(() => {
    const map = new Map<string, ItemManifestRecord[]>();
    for (const item of manifestItems) {
      const normTrf = normalizeLookupCode(item.trf);
      if (!normTrf) continue;
      const existing = map.get(normTrf);
      if (existing) {
        existing.push(item);
      } else {
        map.set(normTrf, [item]);
      }
    }
    return map;
  }, [manifestItems]);

  const getItemsForTrf = useCallback(
    (trf?: string | null): ItemManifestRecord[] => {
      const normTrf = normalizeLookupCode(trf);
      if (!normTrf) return [];
      return itemsByTrfMap.get(normTrf) || [];
    },
    [itemsByTrfMap]
  );

  const availableTrfNumbers = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const activeBoxTrf = (trfLookupBox?.trf || '').trim();
    const activeNorm = normalizeLookupCode(activeBoxTrf);
    if (activeNorm) {
      seen.add(activeNorm);
      list.push(activeBoxTrf);
    }
    for (const box of [...unscannedBoxes, ...scannedBoxes]) {
      const rawTrf = (box.trf || '').trim();
      const norm = normalizeLookupCode(rawTrf);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push(rawTrf);
      }
      if (list.length >= 24) break;
    }
    if (list.length < 24) {
      for (const item of manifestItems) {
        const rawTrf = (item.trf || '').trim();
        const norm = normalizeLookupCode(rawTrf);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          list.push(rawTrf);
        }
        if (list.length >= 24) break;
      }
    }
    return list.slice(0, 24);
  }, [trfLookupBox, unscannedBoxes, scannedBoxes, manifestItems]);

  const matchedTrfItems = useMemo(
    () => getItemsForTrf(trfLookupQuery),
    [getItemsForTrf, trfLookupQuery]
  );

  const filteredTrfItems = useMemo(() => {
    const q = trfItemSearchQuery.trim();
    if (!q) return matchedTrfItems;
    const upperQ = q.toUpperCase();
    const normQ = normalizeLookupCode(q);
    return matchedTrfItems.filter((item) => {
      const skuUpper = (item.sku || '').toUpperCase();
      const upcUpper = (item.upc || '').toUpperCase();
      const descUpper = (item.description || '').toUpperCase();
      const cidUpper = (item.cid || '').toUpperCase();
      if (
        skuUpper.includes(upperQ) ||
        upcUpper.includes(upperQ) ||
        descUpper.includes(upperQ) ||
        cidUpper.includes(upperQ)
      ) {
        return true;
      }
      if (normQ) {
        const normSku = normalizeLookupCode(item.sku);
        const normUpc = normalizeLookupCode(item.upc);
        if (normSku.includes(normQ) || normUpc.includes(normQ)) {
          return true;
        }
      }
      return false;
    });
  }, [matchedTrfItems, trfItemSearchQuery]);

  const totalMatchedQty = useMemo(
    () => matchedTrfItems.reduce((sum, item) => sum + (item.qty || 1), 0),
    [matchedTrfItems]
  );

  const totalScannedMatchedQty = useMemo(
    () => matchedTrfItems.reduce((sum, item) => sum + (scannedItemsMap[item.id] || 0), 0),
    [matchedTrfItems, scannedItemsMap]
  );

  const openTrfLookupModal = useCallback((box?: BoxManifestRecord | null, customTrf?: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setConfirmCidModal(null);
    setShowManual(false);
    setTrfLookupBox(box || null);
    setTrfLookupQuery((customTrf ?? box?.trf ?? '').trim());
    setTrfItemSearchQuery('');
    setShowTrfLookupModal(true);
  }, []);

  const closeTrfLookupModal = useCallback(() => {
    setImageZoomModal(null);
    setShowTrfLookupModal(false);
    setTrfLookupBox(null);
    setTrfItemSearchQuery('');
  }, []);

  /**
   * Upload or refresh the Scanning Items Manifest CSV directly from the TRF Lookup Modal.
   * Schema: CID NO, TRF NO, UPC, SKU, DESCRIPTION, QTY
   */
  const handleUploadItemsCsvForLookup = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setIsUploadingItemsCsv(true);
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
        setIsUploadingItemsCsv(false);
        showNotification('error', 'CSV PARSE ERROR', fatalErrors[0].message);
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
        const trf = getRowVal(row, ['TRF NO', 'TRF', 'TRF_NO', 'TRFNO', 'TRANSFER NO', 'TRANSFER']);
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
        setIsUploadingItemsCsv(false);
        showNotification(
          'error',
          'INVALID ITEMS CSV',
          'No items found matching schema (CID NO, TRF NO, UPC, SKU, DESCRIPTION, QTY)'
        );
        return;
      }

      await AsyncStorage.removeItem(SCANNED_ITEMS_KEY);
      await AsyncStorage.setItem(MANIFEST_ITEMS_KEY, JSON.stringify(itemsList));
      await AsyncStorage.setItem(ACTIVE_ITEM_FILE_KEY, asset.name);

      const totalQty = itemsList.reduce((sum, item) => sum + (item.qty || 1), 0);
      await saveSessionToHistory({
        type: 'item',
        fileName: asset.name,
        totalCount: totalQty,
        scannedCount: 0,
        manifestData: itemsList,
        scannedData: {},
      });

      setManifestItems(itemsList);
      setScannedItemsMap({});
      setActiveItemFileName(asset.name);
      setIsUploadingItemsCsv(false);

      showNotification(
        'success',
        '✓ ITEMS CSV LOADED',
        `Loaded ${itemsList.length} items (${totalQty} total qty) from ${asset.name}`
      );
      playScanFeedback('success');
    } catch (err: unknown) {
      setIsUploadingItemsCsv(false);
      const msg = err instanceof Error ? err.message : 'Failed to upload Scanning Items CSV';
      showNotification('error', 'UPLOAD FAILED', msg);
    }
  }, [showNotification]);

  /**
   * Open the selected TRF item in Expo WebBrowser searching via Google Images with its UPC code.
   */
  const handleOpenItemSearchInBrowser = useCallback(
    async (item: ItemManifestRecord) => {
      const upc = (item.upc || item.sku || '').trim();
      if (!upc) {
        showNotification(
          'warning',
          'NO UPC CODE',
          'This item does not have a UPC or SKU code to search.'
        );
        return;
      }

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      const encodedUpc = encodeURIComponent(upc);
      const targetUrl = `https://www.google.com/search?q=${encodedUpc}&sca_esv=a85b4e24109f6447&sxsrf=APpeQnt9U35B30l03bld-TQQb98xADg7qg:1792820210743&source=hp&biw=1470&bih=836&ei=8kPcap3PK66rur8PqOKRsQc&iflsig=ABILxe8AAAAAatxSAtb05O5zAiAoMNBId42-2949szRy&ved=0ahUKEwidkLne99GXAxWule4BHShxJHYQ4dUDCBg&uact=5&oq=${encodedUpc}&gs_lp=EgNpbWciDTQ1NDkxMzE1NTA0ODEyBxAjGMkCGCdIsgRQAFgAcAB4AJABAJgBUKABUKoBATG4AQPIAQCKAgtnd3Mtd2l6LWltZ5gCAaACWZgDAIgGAZIHATGgB6ABsgcBMbgHWcIHAzItMcgHBYAIAQ&sclient=img&udm=2`;

      try {
        await WebBrowser.openBrowserAsync(targetUrl);
      } catch {
        try {
          await Linking.openURL(targetUrl);
        } catch {
          showNotification('error', 'CANNOT OPEN BROWSER', 'Failed to launch web browser.');
        }
      }
    },
    [showNotification]
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
          const updated = prev.some((c) => c.cid === unscannedMatch.cid)
            ? prev
            : [unscannedMatch, ...prev];
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
              keyboardType="number-pad"
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
              className={`mb-4 rounded-lg border p-3 ${
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

            {confirmCidModal && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => openTrfLookupModal(confirmCidModal)}
                className={`mb-4 flex-row items-center justify-center gap-2 rounded-lg border py-2.5 ${
                  isDark ? 'border-[#ff80ab]/40 bg-[#131316]' : 'border-[#e5005c]/30 bg-[#fff5f8]'
                }`}>
                <Package color={isDark ? '#ff80ab' : '#e5005c'} size={15} />
                <Text
                  className={`font-jetbrains text-xs font-bold ${
                    isDark ? 'text-[#ff80ab]' : 'text-[#e5005c]'
                  }`}>
                  {confirmCidModal.trf && getItemsForTrf(confirmCidModal.trf).length > 0
                    ? `LOOKUP TRF ITEMS (${getItemsForTrf(confirmCidModal.trf).length})`
                    : 'LOOKUP TRF ITEMS'}
                </Text>
              </TouchableOpacity>
            )}

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

      {/* TRF NO Items Lookup Modal */}
      <Modal
        visible={showTrfLookupModal}
        transparent
        animationType="fade"
        onRequestClose={imageZoomModal ? () => setImageZoomModal(null) : closeTrfLookupModal}>
        <View className="flex-1 items-center justify-center bg-black/75 px-4 py-8">
          <View
            className={`max-h-[88%] w-full overflow-hidden rounded-2xl border shadow-2xl ${
              isDark ? 'border-[#3f3f46] bg-[#18181b]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            {/* Modal Header */}
            <View
              className={`flex-row items-center justify-between border-b px-4 py-3.5 ${
                isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#fafafa]'
              }`}>
              <View className="flex-1 flex-row items-center gap-2.5 pr-2">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#ff80ab]/15">
                  <Package color="#ff80ab" size={18} />
                </View>
                <View className="flex-1">
                  <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                    TRF Items Lookup
                  </Text>
                  <Text
                    className={`font-jetbrains text-[10px] ${textSecondaryClass}`}
                    numberOfLines={1}>
                    {manifestItems.length > 0
                      ? `CSV: ${activeItemFileName || 'Scanning Items Manifest'} (${manifestItems.length} rows)`
                      : 'No Scanning Items CSV uploaded'}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={isUploadingItemsCsv}
                  onPress={handleUploadItemsCsvForLookup}
                  className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                    isDark
                      ? 'border-[#ff80ab]/40 bg-[#ff80ab]/10'
                      : 'border-[#e5005c]/30 bg-[#e5005c]/10'
                  }`}>
                  {isUploadingItemsCsv ? (
                    <ActivityIndicator size="small" color="#ff80ab" />
                  ) : (
                    <FileText color={isDark ? '#ff80ab' : '#e5005c'} size={13} />
                  )}
                  <Text
                    className={`font-jetbrains text-[10px] font-bold ${
                      isDark ? 'text-[#ff80ab]' : 'text-[#e5005c]'
                    }`}>
                    {manifestItems.length > 0 ? 'CSV' : 'UPLOAD CSV'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={closeTrfLookupModal}
                  className={`h-8 w-8 items-center justify-center rounded-lg border ${
                    isDark ? 'border-[#3f3f46] bg-[#27272a]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
                  }`}>
                  <X color={isDark ? '#fafafa' : '#18181b'} size={16} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Selected Box Context Bar (when opened from a Box Card) */}
            {trfLookupBox && (
              <View
                className={`flex-row items-center justify-between border-b px-4 py-2.5 ${
                  isDark ? 'border-[#3f3f46]/70 bg-[#131316]' : 'border-[#e4e4e7] bg-[#fff5f8]'
                }`}>
                <View className="flex-1 pr-2">
                  <Text
                    className={`font-jetbrains text-xs font-bold ${
                      isDark ? 'text-[#ffb2c3]' : 'text-[#e5005c]'
                    }`}
                    numberOfLines={1}>
                    BOX CID: {trfLookupBox.cid}
                  </Text>
                  <Text className={`font-jetbrains text-[11px] ${textSecondaryClass}`}>
                    BOX TRF NO:{' '}
                    <Text className={`font-bold ${textPrimaryClass}`}>
                      {trfLookupBox.trf || 'N/A'}
                    </Text>
                  </Text>
                </View>

                {unscannedBoxes.some(
                  (b) => b.cid.toUpperCase() === trfLookupBox.cid.toUpperCase()
                ) ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      const targetCid = trfLookupBox.cid;
                      closeTrfLookupModal();
                      handleScan(targetCid);
                    }}
                    className="rounded-lg bg-[#e5005c] px-3 py-1.5">
                    <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
                      MARK SCANNED
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="flex-row items-center gap-1 rounded-md border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-1">
                    <CheckCircle color="#22c55e" size={12} />
                    <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                      SCANNED
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* TRF NO Search Input + Quick TRF Chips */}
            <View
              className={`border-b px-4 py-3 ${
                isDark ? 'border-[#3f3f46] bg-[#18181b]' : 'border-[#e4e4e7] bg-[#ffffff]'
              }`}>
              <Text className={`mb-1.5 font-jetbrains text-[10px] font-bold ${textSecondaryClass}`}>
                LOOKUP BY TRF NO
              </Text>
              <View
                className={`flex-row items-center rounded-xl border px-3 ${
                  isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#d4d4d8] bg-[#fafafa]'
                }`}>
                <Search color="#ff80ab" size={16} />
                <TextInput
                  value={trfLookupQuery}
                  onChangeText={(val) => {
                    setTrfLookupQuery(val);
                    setTrfItemSearchQuery('');
                  }}
                  placeholder="Enter TRF NO (e.g. 2311699)..."
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  className={`h-10 flex-1 px-2.5 font-jetbrains text-xs font-bold ${
                    isDark ? 'text-[#fafafa]' : 'text-[#18181b]'
                  }`}
                />
                {trfLookupQuery.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setTrfLookupQuery('');
                      setTrfItemSearchQuery('');
                    }}
                    className="p-1">
                    <X color={isDark ? '#a1a1aa' : '#71717a'} size={15} />
                  </TouchableOpacity>
                )}
              </View>

              {availableTrfNumbers.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-2.5"
                  contentContainerStyle={{ gap: 6 }}>
                  {availableTrfNumbers.map((trfCode) => {
                    const isSelected =
                      normalizeLookupCode(trfCode) === normalizeLookupCode(trfLookupQuery);
                    const count = getItemsForTrf(trfCode).length;
                    return (
                      <TouchableOpacity
                        key={trfCode}
                        activeOpacity={0.75}
                        onPress={() => {
                          setTrfLookupQuery(trfCode);
                          setTrfItemSearchQuery('');
                        }}
                        className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
                          isSelected
                            ? 'border-[#ff80ab] bg-[#ff80ab]'
                            : isDark
                              ? 'border-[#3f3f46] bg-[#1f1f22]'
                              : 'border-[#e4e4e7] bg-[#f4f4f5]'
                        }`}>
                        <Text
                          className={`font-jetbrains text-[10px] font-bold ${
                            isSelected ? 'text-[#131316]' : textPrimaryClass
                          }`}>
                          {trfCode}
                        </Text>
                        {manifestItems.length > 0 && (
                          <Text
                            className={`font-jetbrains text-[9px] font-bold ${
                              isSelected ? 'text-[#131316]/80' : textSecondaryClass
                            }`}>
                            ({count})
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Summary Stats & In-TRF Item Filter */}
            {manifestItems.length > 0 && trfLookupQuery.trim().length > 0 && (
              <View
                className={`border-b px-4 py-2.5 ${
                  isDark ? 'border-[#3f3f46] bg-[#1f1f22]/60' : 'border-[#e4e4e7] bg-[#fafafa]'
                }`}>
                <View className="flex-row flex-wrap items-center gap-2">
                  <View className="rounded-md border border-[#ff80ab]/30 bg-[#ff80ab]/10 px-2 py-1">
                    <Text className="font-jetbrains text-[10px] font-bold text-[#ff80ab]">
                      TRF: {trfLookupQuery.trim().toUpperCase()}
                    </Text>
                  </View>
                  <View
                    className={`rounded-md border px-2 py-1 ${
                      isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
                    }`}>
                    <Text className={`font-jetbrains text-[10px] font-bold ${textPrimaryClass}`}>
                      ITEMS: {matchedTrfItems.length}
                    </Text>
                  </View>
                  <View
                    className={`rounded-md border px-2 py-1 ${
                      isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
                    }`}>
                    <Text className={`font-jetbrains text-[10px] font-bold ${textPrimaryClass}`}>
                      TOTAL QTY: {totalMatchedQty}
                    </Text>
                  </View>
                  {totalScannedMatchedQty > 0 && (
                    <View className="rounded-md border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-1">
                      <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                        SCANNED: {totalScannedMatchedQty}/{totalMatchedQty}
                      </Text>
                    </View>
                  )}
                </View>

                {matchedTrfItems.length > 1 && (
                  <View
                    className={`mt-2 flex-row items-center rounded-lg border px-2.5 ${
                      isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
                    }`}>
                    <Search color={isDark ? '#71717a' : '#a1a1aa'} size={14} />
                    <TextInput
                      value={trfItemSearchQuery}
                      onChangeText={setTrfItemSearchQuery}
                      placeholder="Filter items by SKU, UPC, or description..."
                      placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      className={`h-8 flex-1 px-2 font-jetbrains text-[11px] ${
                        isDark ? 'text-[#fafafa]' : 'text-[#18181b]'
                      }`}
                    />
                    {trfItemSearchQuery.length > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setTrfItemSearchQuery('')}
                        className="p-1">
                        <X color={isDark ? '#a1a1aa' : '#71717a'} size={13} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Modal Body: Matched Items List or Empty States */}
            {manifestItems.length === 0 ? (
              <View className="items-center justify-center px-6 py-10">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-[#ff80ab]/15">
                  <FileText color="#ff80ab" size={28} />
                </View>
                <Text
                  className={`mb-1.5 text-center font-hanken text-base font-bold ${textPrimaryClass}`}>
                  No Scanning Items CSV Loaded
                </Text>
                <Text
                  className={`mb-5 text-center font-hanken text-xs leading-4 ${textSecondaryClass}`}>
                  Upload your Scanning Items manifest CSV file (CID NO, TRF NO, UPC, SKU,
                  DESCRIPTION, QTY) to lookup items by TRF NO.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isUploadingItemsCsv}
                  onPress={handleUploadItemsCsvForLookup}
                  className="flex-row items-center gap-2 rounded-xl bg-[#e5005c] px-5 py-3">
                  {isUploadingItemsCsv ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <FileText color="#ffffff" size={16} />
                  )}
                  <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                    UPLOAD SCANNING ITEMS CSV
                  </Text>
                </TouchableOpacity>
              </View>
            ) : !trfLookupQuery.trim() ? (
              <View className="items-center justify-center px-6 py-10">
                <Search color={isDark ? '#52525b' : '#a1a1aa'} size={32} />
                <Text
                  className={`mt-3 text-center font-hanken text-sm font-bold ${textPrimaryClass}`}>
                  Enter or Select a TRF NO
                </Text>
                <Text className={`mt-1 text-center font-hanken text-xs ${textSecondaryClass}`}>
                  {trfLookupBox && !trfLookupBox.trf
                    ? `Box CID ${trfLookupBox.cid} does not have a TRF NO in the Box Manifest. Type or tap a TRF NO above to inspect items.`
                    : 'Type a TRF NO above or tap one of the quick TRF chips to view its manifest items.'}
                </Text>
              </View>
            ) : matchedTrfItems.length === 0 ? (
              <View className="items-center justify-center px-6 py-10">
                <AlertTriangle color="#eab308" size={32} />
                <Text
                  className={`mt-3 text-center font-hanken text-sm font-bold ${textPrimaryClass}`}>
                  No Items Found for TRF {trfLookupQuery.trim().toUpperCase()}
                </Text>
                <Text
                  className={`mt-1.5 text-center font-hanken text-xs leading-4 ${textSecondaryClass}`}>
                  {`No rows matched TRF NO "${trfLookupQuery.trim()}" in ${
                    activeItemFileName || 'the uploaded Scanning Items CSV'
                  }.`}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isUploadingItemsCsv}
                  onPress={handleUploadItemsCsvForLookup}
                  className={`mt-4 flex-row items-center gap-2 rounded-xl border px-4 py-2.5 ${
                    isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                  }`}>
                  <FileText color="#ff80ab" size={15} />
                  <Text className="font-jetbrains text-xs font-bold text-[#ff80ab]">
                    UPLOAD DIFFERENT ITEMS CSV
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredTrfItems}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                style={{ flexGrow: 0, flexShrink: 1 }}
                className="px-4 py-3"
                contentContainerStyle={{ paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={8}
                ListEmptyComponent={
                  <View className="items-center justify-center py-12">
                    <Text className={`font-hanken text-xs ${textSecondaryClass}`}>
                      {`No items in TRF ${trfLookupQuery.trim()} match "${trfItemSearchQuery.trim()}".`}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TrfLookupItemCard
                    item={item}
                    isDark={isDark}
                    textPrimaryClass={textPrimaryClass}
                    textSecondaryClass={textSecondaryClass}
                    uploadedImageUrl={uploadedItemImages[getItemImageKey(item)]}
                    scannedQty={scannedItemsMap[item.id] || 0}
                    expectedQty={item.qty || 1}
                    onOpenSearchInBrowser={handleOpenItemSearchInBrowser}
                    onPressPreviewImage={(payload) => setImageZoomModal(payload)}
                  />
                )}
              />
            )}
          </View>
        </View>

        {imageZoomModal && (
          <View style={StyleSheet.absoluteFill} className="z-50">
            <ItemImageZoomModalContent
              key={imageZoomModal.item.id}
              data={imageZoomModal}
              isDark={isDark}
              scannedQty={scannedItemsMap[imageZoomModal.item.id] || 0}
              onClose={() => setImageZoomModal(null)}
            />
          </View>
        )}
      </Modal>

      {/* Header */}
      <View className={`flex-row items-center gap-2.5 border-b px-4 py-2.5 ${headerBgClass}`}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color={isDark ? '#fafafa' : '#18181b'} size={22} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className={`font-hanken text-xl font-bold ${textPrimaryClass}`}>Scanning</Text>
        </View>
        {lastScanned && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              const matchedBox = [...scannedBoxes, ...unscannedBoxes].find(
                (b) => b.cid.toUpperCase() === lastScanned.toUpperCase()
              );
              openTrfLookupModal(matchedBox || null, matchedBox?.trf || '');
            }}
            className="flex-row items-center gap-1.5 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-2.5 py-1.5">
            <CheckCircle color="#22c55e" size={13} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]" numberOfLines={1}>
              {lastScanned}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => openTrfLookupModal(null, '')}
          className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
            isDark ? 'border-[#ff80ab]/40 bg-[#ff80ab]/10' : 'border-[#e5005c]/30 bg-[#e5005c]/10'
          }`}>
          <Package color={isDark ? '#ff80ab' : '#e5005c'} size={14} />
          <Text
            className={`font-jetbrains text-[10px] font-bold ${
              isDark ? 'text-[#ff80ab]' : 'text-[#e5005c]'
            }`}>
            TRF LOOKUP
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fast Screen Switch Tab Bar (Box Scanner <-> Item Scanner) */}
      <View
        className={`border-b px-4 py-2 ${
          isDark ? 'border-[#3f3f46] bg-[#18181b]' : 'border-[#e4e4e7] bg-[#fafafa]'
        }`}>
        <View
          className={`flex-row items-center rounded-xl border p-1 ${
            isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
          }`}>
          {/* Active Box Scanner Tab */}
          <View
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 ${
              isDark ? 'bg-[#ff80ab]' : 'bg-[#e5005c]'
            }`}>
            <BoxIcon color={isDark ? '#131316' : '#ffffff'} size={14} />
            <Text
              className={`font-jetbrains text-[11px] font-extrabold ${
                isDark ? 'text-[#131316]' : 'text-[#ffffff]'
              }`}>
              BOX SCANNER
            </Text>
            {totalBoxes > 0 && (
              <View
                className={`rounded-full px-1.5 py-0.5 ${
                  isDark ? 'bg-[#131316]/20' : 'bg-[#ffffff]/25'
                }`}>
                <Text
                  className={`font-jetbrains text-[9px] font-bold ${
                    isDark ? 'text-[#131316]' : 'text-[#ffffff]'
                  }`}>
                  {scannedBoxes.length}/{totalBoxes}
                </Text>
              </View>
            )}
          </View>

          {/* Fast Switch to Item Scanner Tab (Tap or Swipe Left) */}
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={isSwitchingToItems}
            onPress={navigateToItemScanner}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 ${
              isSwipingLeftHint
                ? isDark
                  ? 'bg-[#e5005c]/25'
                  : 'bg-[#e5005c]/15'
                : 'bg-transparent'
            }`}>
            <Scan
              color={isSwipingLeftHint ? '#e5005c' : isDark ? '#a1a1aa' : '#71717a'}
              size={14}
            />
            <Text
              className={`font-jetbrains text-[11px] font-bold ${
                isSwipingLeftHint ? 'text-[#e5005c]' : textSecondaryClass
              }`}>
              ITEM SCANNER
            </Text>
            {manifestItems.length > 0 && (
              <View
                className={`rounded-full px-1.5 py-0.5 ${
                  isSwipingLeftHint ? 'bg-[#e5005c]/20' : isDark ? 'bg-[#27272a]' : 'bg-[#e4e4e7]'
                }`}>
                <Text
                  className={`font-jetbrains text-[9px] font-bold ${
                    isSwipingLeftHint ? 'text-[#e5005c]' : textSecondaryClass
                  }`}>
                  {manifestItems.length}
                </Text>
              </View>
            )}
            <ChevronRight
              color={isSwipingLeftHint ? '#e5005c' : isDark ? '#71717a' : '#a1a1aa'}
              size={13}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Notification Toast Banner */}
      {notification && (
        <View
          style={{ zIndex: 999, elevation: 10 }}
          className={`absolute left-4 right-4 top-28 flex-row items-center gap-3 rounded-xl border p-3.5 shadow-2xl ${
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

      {/* Swipeable Screen Body (Swipe Left -> Item Scanner) */}
      <Animated.View
        style={{ flex: 1, transform: [{ translateX: swipeTranslateX }] }}
        {...screenSwipePanResponder.panHandlers}>
        {isSwipingLeftHint && (
          <View
            pointerEvents="none"
            style={{ zIndex: 950, elevation: 9 }}
            className="absolute right-3 top-1/2 -mt-6 flex-row items-center gap-1.5 rounded-full border border-[#e5005c] bg-[#e5005c] px-3.5 py-2 shadow-xl">
            <Scan color="#ffffff" size={14} />
            <Text className="font-jetbrains text-[10px] font-extrabold text-[#ffffff]">
              RELEASE FOR ITEMS
            </Text>
            <ChevronRight color="#ffffff" size={14} />
          </View>
        )}

        {/* Camera Area (Hidden when swiped up into full screen tabs) */}
        {!isFullScreenTabs && (
          <View className="relative h-[40%] overflow-hidden bg-black">
            {!permission ? (
              // Permissions loading
              <View className="flex-1 items-center justify-center gap-2">
                <ActivityIndicator size="small" color="#ff80ab" />
                <Text className={`font-hanken text-sm ${textSecondaryClass}`}>
                  Loading camera...
                </Text>
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
            ) : !isCameraActive ? (
              <View className="flex-1 items-center justify-center gap-2 bg-black">
                <ActivityIndicator size="small" color="#ff80ab" />
                <Text className="font-jetbrains text-[11px] text-[#a1a1aa]">
                  Initializing camera...
                </Text>
              </View>
            ) : (
              // Live camera with barcode scanning
              <CameraView
                key={`box-camera-${cameraSessionKey}`}
                ref={boxCameraRef}
                style={{ flex: 1 }}
                facing="back"
                onCameraReady={() => {
                  setIsBoxCameraReady(true);
                }}
                onMountError={() => {
                  if (cameraRetryCountRef.current < 3) {
                    cameraRetryCountRef.current += 1;
                    remountBoxCameraWithGap();
                  }
                }}
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

        {/* Optional Bluetooth & Manual Barcode Scanner Input (Toggle to activate when swiped up) */}
        {isFullScreenTabs && (
          <View
            className={`border-b px-4 py-2.5 shadow-sm ${
              isDark ? 'border-[#3f3f46] bg-[#1a1a1d]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-2 pr-2">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isBluetoothScannerActive
                      ? 'bg-[#ff80ab]/15'
                      : isDark
                        ? 'bg-[#2a2a2d]'
                        : 'bg-[#f4f4f5]'
                  }`}>
                  <Bluetooth
                    color={isBluetoothScannerActive ? '#ff80ab' : isDark ? '#a1a1aa' : '#71717a'}
                    size={14}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-jetbrains text-[11px] font-bold ${
                      isBluetoothScannerActive ? 'text-[#ff80ab]' : textPrimaryClass
                    }`}>
                    {isBluetoothScannerActive ? 'BLUETOOTH SCANNER ACTIVE' : 'BLUETOOTH SCANNER'}
                  </Text>
                  {!isBluetoothScannerActive && (
                    <Text
                      className={`font-hanken text-[10px] ${textSecondaryClass}`}
                      numberOfLines={1}>
                      Optional · Tap toggle to activate scanner input
                    </Text>
                  )}
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                {isBluetoothScannerActive && (
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
                      {isBuffering ? 'READING...' : '0.5S READY'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={toggleBluetoothScanner}
                  activeOpacity={0.8}
                  className={`flex-row items-center gap-2 rounded-full border px-2.5 py-1 ${
                    isBluetoothScannerActive
                      ? isDark
                        ? 'border-[#ff80ab] bg-[#ff80ab]'
                        : 'border-[#e5005c] bg-[#e5005c]'
                      : isDark
                        ? 'border-[#3f3f46] bg-[#2a2a2d]'
                        : 'border-[#d4d4d8] bg-[#f4f4f5]'
                  }`}>
                  <Text
                    className={`font-jetbrains text-[10px] font-bold ${
                      isBluetoothScannerActive
                        ? isDark
                          ? 'text-[#131316]'
                          : 'text-[#ffffff]'
                        : textSecondaryClass
                    }`}>
                    {isBluetoothScannerActive ? 'ACTIVE' : 'OFF'}
                  </Text>
                  <View
                    className={`h-4 w-7 justify-center rounded-full px-0.5 ${
                      isBluetoothScannerActive
                        ? isDark
                          ? 'items-end bg-black/25'
                          : 'items-end bg-white/30'
                        : isDark
                          ? 'items-start bg-[#131316]'
                          : 'items-start bg-[#d4d4d8]'
                    }`}>
                    <View className="h-3 w-3 rounded-full bg-[#ffffff]" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {isBluetoothScannerActive && (
              <View className="mt-2.5">
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
                    className="h-11 items-center justify-center rounded-xl bg-[#ff80ab] px-4">
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
            renderItem={({ item: box }) => {
              const trfItemsCount = box.trf ? getItemsForTrf(box.trf).length : 0;
              return (
                <TouchableOpacity
                  onPress={() =>
                    activeTab === 'unscanned' ? setConfirmCidModal(box) : openTrfLookupModal(box)
                  }
                  activeOpacity={0.7}
                  className={`mb-3 flex-row items-center justify-between rounded-lg border p-4 ${
                    activeTab === 'scanned' ? 'border-[#22c55e]/40 bg-[#22c55e]/5' : cardBgClass
                  }`}>
                  <View className="flex-1 pr-2">
                    <Text className="font-jetbrains text-sm font-semibold text-[#ff80ab]">
                      CID NO. : {box.cid}
                    </Text>
                    {box.trf ? (
                      <Text className={`mt-1 font-jetbrains text-xs ${textSecondaryClass}`}>
                        TRF NO. :{' '}
                        <Text className={`font-semibold ${textPrimaryClass}`}>{box.trf}</Text>
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => openTrfLookupModal(box)}
                      className={`flex-row items-center gap-1 rounded-md border px-2.5 py-1.5 ${
                        isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
                      }`}>
                      <Package color={isDark ? '#ff80ab' : '#e5005c'} size={12} />
                      <Text
                        className={`font-jetbrains text-[10px] font-bold ${
                          isDark ? 'text-[#ff80ab]' : 'text-[#e5005c]'
                        }`}>
                        {trfItemsCount > 0 ? `ITEMS (${trfItemsCount})` : 'ITEMS'}
                      </Text>
                    </TouchableOpacity>

                    {activeTab === 'scanned' && <CheckCircle color="#22c55e" size={18} />}
                    {activeTab === 'unscanned' && (
                      <View className="rounded border border-[#ff80ab]/30 bg-[#ff80ab]/10 px-2 py-1">
                        <Text className="font-jetbrains text-[9px] font-bold text-[#ff80ab]">
                          SCAN
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
        <View className={`border-t px-4 py-4 pb-6 ${footerBgClass}`}>
          <View className="mb-2 flex-row items-end justify-between">
            <View className="flex-row items-baseline gap-2">
              <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                TOTAL PROGRESS
              </Text>
              <Text className="font-jetbrains text-sm font-bold text-[#ff80ab]">
                {progressPct}%
              </Text>
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
            <View
              className="h-full rounded-full bg-[#ff80ab]"
              style={{ width: `${progressPct}%` }}
            />
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
