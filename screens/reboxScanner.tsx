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
  ScrollView,
  Platform,
  Image,
  StatusBar,
  StyleSheet,
  BackHandler,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Boxes,
  ChevronUp,
  ChevronDown,
  Search,
  RotateCcw,
  ArrowUpDown,
  Bluetooth,
  ZoomIn,
  ZoomOut,
  Camera,
  CloudUpload,
  Flashlight,
  Trash2,
  Edit3,
  RefreshCw,
  Layers,
  ExternalLink,
  Download,
} from 'lucide-react-native';
import { NavigationContext, useFocusEffect, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/theme';
import { useAuth } from '../context/auth';
import {
  SCAN_HISTORY_KEY,
  MANIFEST_ITEMS_KEY,
  UPLOADED_ITEM_IMAGES_KEY,
  type HistorySessionRecord,
  type ItemManifestRecord,
  saveSessionToHistory,
} from '../utils/storage';
import {
  type ReboxItem,
  type ReboxBoxSummary,
  fetchReboxItems,
  fetchReboxBoxes,
  saveReboxItem,
  updateReboxItemQty,
  refillItemFromBox,
  deleteReboxItem,
  REBOX_HOLD_PRESS_IN_DELAY_MS,
  REBOX_HOLD_LONG_PRESS_DELAY_MS,
  lookupItemDetails,
  uploadReboxImageToCloudinary,
  checkExistingProductImage,
  ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET,
  isUploadedPhoto,
  fetchOpenSheetCatalog,
  getActiveReboxBox,
  setActiveReboxBox,
  normalizeBoxNumber,
  downloadReboxPdf,
  type ProductItem,
} from '../utils/rebox';

export { SCAN_HISTORY_KEY, type HistorySessionRecord, saveSessionToHistory };

const playScanFeedback = async (type: 'success' | 'warning' | 'error') => {
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
        if (type === 'success') {
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
};

async function cropImageToSquare(
  uri: string,
  fallbackWidth?: number,
  fallbackHeight?: number
): Promise<string> {
  try {
    const mod = ImageManipulator as unknown as {
      manipulateAsync?: (
        uri: string,
        actions: object[],
        options: object
      ) => Promise<{ uri: string }>;
      SaveFormat?: { JPEG: 'jpeg' };
      ImageManipulator?: {
        manipulate: (source: unknown) => {
          crop: (rect: { originX: number; originY: number; width: number; height: number }) => void;
          renderAsync: () => Promise<{
            width?: number;
            height?: number;
            saveAsync: (options: object) => Promise<{ uri: string }>;
          }>;
        };
      };
    };

    if (mod.ImageManipulator?.manipulate) {
      const initialRef = await mod.ImageManipulator.manipulate(uri).renderAsync();
      const imgWidth = initialRef.width || fallbackWidth || 0;
      const imgHeight = initialRef.height || fallbackHeight || 0;

      if (imgWidth > 0 && imgHeight > 0) {
        if (imgWidth === imgHeight) return uri;
        const size = Math.min(imgWidth, imgHeight);
        const originX = Math.floor((imgWidth - size) / 2);
        const originY = Math.floor((imgHeight - size) / 2);

        const cropContext = mod.ImageManipulator.manipulate(initialRef);
        cropContext.crop({ originX, originY, width: size, height: size });
        const croppedRef = await cropContext.renderAsync();
        const saved = await croppedRef.saveAsync({
          compress: 0.9,
          format: mod.SaveFormat?.JPEG || 'jpeg',
        });
        return saved.uri;
      }
    }

    if (typeof mod.manipulateAsync === 'function' && fallbackWidth && fallbackHeight) {
      if (fallbackWidth === fallbackHeight) return uri;
      const size = Math.min(fallbackWidth, fallbackHeight);
      const originX = Math.floor((fallbackWidth - size) / 2);
      const originY = Math.floor((fallbackHeight - size) / 2);
      const cropped = await mod.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width: size, height: size } }],
        {
          compress: 0.9,
          format: mod.SaveFormat?.JPEG || 'jpeg',
        }
      );
      return cropped.uri;
    }
  } catch {}

  return uri;
}

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

function getItemImageKey(item: { upc?: string; sku?: string; id?: string }): string {
  const upc = (item.upc || '').trim();
  if (upc) return `upc:${upc}`;
  const sku = (item.sku || '').trim();
  if (sku) return `sku:${sku}`;
  return item.id ? `id:${item.id}` : '';
}

const failedItemImagesCache = new Set<string>();

interface ItemImagePreviewPayload {
  item: { upc?: string; sku?: string; description?: string; id?: string };
  thumbnailUrl: string;
  highResUrl: string;
  boxNumber?: string;
  qty?: number;
}

function ReboxItemCard({
  item,
  isDark,
  textPrimaryClass,
  textSecondaryClass,
  uploadedImageUrl,
  isCheckingImage,
  mode,
  onOpenSearchInBrowser,
  onPressPreviewImage,
  onPressUploadImage,
  onRefill,
  onQtyAdjust,
  onHoldDelete,
}: {
  item: ReboxItem;
  isDark: boolean;
  textPrimaryClass: string;
  textSecondaryClass: string;
  uploadedImageUrl?: string;
  isCheckingImage?: boolean;
  mode: 'current_box' | 'refill_search';
  onOpenSearchInBrowser: (item: { upc?: string; sku?: string; description?: string }) => void;
  onPressPreviewImage: (payload: ItemImagePreviewPayload) => void;
  onPressUploadImage: (item: ReboxItem) => void;
  onRefill: (item: ReboxItem) => void;
  onQtyAdjust: (item: ReboxItem, delta: number) => void;
  onHoldDelete: (item: ReboxItem) => Promise<void> | void;
}) {
  const cleanUpc = (item.upc || '').trim();
  const [fallbackTier, setFallbackTier] = useState<'daiso' | 'cloudinary_products' | 'cloudinary_root'>(
    'daiso'
  );
  const [failedUpc, setFailedUpc] = useState<string | null>(() =>
    cleanUpc && failedItemImagesCache.has(cleanUpc) ? cleanUpc : null
  );
  const [failedUploadedUri, setFailedUploadedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [isHoldingDelete, setIsHoldingDelete] = useState<boolean>(false);
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);
  const [holdProgressAnim] = useState(() => new Animated.Value(0));
  const didLongPressRef = useRef(false);
  const pressStartTimeRef = useRef(0);

  const candidateUpload = isUploadedPhoto(uploadedImageUrl) ? uploadedImageUrl : undefined;
  const activeUploadedUrl =
    candidateUpload && failedUploadedUri !== candidateUpload ? candidateUpload : undefined;

  const isImageMissing =
    !activeUploadedUrl &&
    (!cleanUpc || failedUpc === cleanUpc || failedItemImagesCache.has(cleanUpc));
  const isImageAvailable = !isImageMissing;

  const imageUrl = activeUploadedUrl
    ? activeUploadedUrl
    : fallbackTier === 'cloudinary_products'
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/products/${cleanUpc}`
      : fallbackTier === 'cloudinary_root'
        ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/${cleanUpc}`
        : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_400x.jpg`;

  const highResUrl = activeUploadedUrl
    ? activeUploadedUrl
    : fallbackTier === 'cloudinary_products'
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/products/${cleanUpc}`
      : fallbackTier === 'cloudinary_root'
        ? `https://res.cloudinary.com/dqtldfxeh/image/upload/${cleanUpc}`
        : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_1000x.jpg`;

  const isLoaded = loadedUri === imageUrl;

  const handleImageError = () => {
    if (activeUploadedUrl) {
      setFailedUploadedUri(activeUploadedUrl);
    } else if (fallbackTier === 'daiso') {
      setFallbackTier('cloudinary_products');
    } else if (fallbackTier === 'cloudinary_products') {
      setFallbackTier('cloudinary_root');
    } else {
      if (cleanUpc) {
        failedItemImagesCache.add(cleanUpc);
      }
      setFailedUpc(cleanUpc);
    }
  };

  const handlePressIn = () => {
    if (isDeletingItem) return;
    didLongPressRef.current = false;
    pressStartTimeRef.current = Date.now();
    setIsHoldingDelete(true);
    holdProgressAnim.stopAnimation();
    holdProgressAnim.setValue(0);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.timing(holdProgressAnim, {
      toValue: 1,
      duration: REBOX_HOLD_LONG_PRESS_DELAY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    holdProgressAnim.stopAnimation();
    holdProgressAnim.setValue(0);
    setIsHoldingDelete(false);
  };

  const handleLongPressDelete = async () => {
    if (isDeletingItem) return;
    didLongPressRef.current = true;
    holdProgressAnim.stopAnimation();
    holdProgressAnim.setValue(0);
    setIsHoldingDelete(false);
    setIsDeletingItem(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    try {
      await onHoldDelete(item);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleCardPress = () => {
    const heldDuration =
      pressStartTimeRef.current > 0 ? Date.now() - pressStartTimeRef.current : 0;
    pressStartTimeRef.current = 0;
    if (didLongPressRef.current || isDeletingItem || heldDuration > 350) {
      didLongPressRef.current = false;
      return;
    }
    if (isImageAvailable && isLoaded) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onPressPreviewImage({
        item,
        thumbnailUrl: imageUrl,
        highResUrl,
        boxNumber: item.boxNumber,
        qty: item.qty,
      });
    }
  };

  const holdBarWidth = holdProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={isDeletingItem}
      delayPressIn={REBOX_HOLD_PRESS_IN_DELAY_MS}
      delayLongPress={REBOX_HOLD_LONG_PRESS_DELAY_MS}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPressDelete}
      onPress={handleCardPress}
      className={`relative mb-2.5 flex-row items-center gap-3 overflow-hidden rounded-xl border p-3 ${
        isDeletingItem ? 'opacity-60 ' : ''
      }${
        isHoldingDelete
          ? 'border-[#ef4444] bg-[#ef4444]/10'
          : mode === 'refill_search'
            ? 'border-[#22c55e]/40 bg-[#22c55e]/5'
            : isDark
              ? 'border-[#3f3f46] bg-[#1f1f22]'
              : 'border-[#e4e4e7] bg-[#ffffff]'
      }`}>
      {/* Thumbnail or Clickable Upload Trigger (shown ONLY when no image is available) */}
      {isImageMissing ? (
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={isCheckingImage}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onPressUploadImage(item);
          }}
          className={`h-16 w-16 items-center justify-center rounded-lg border border-dashed px-1 ${
            isDark ? 'border-[#e5005c]/60 bg-[#e5005c]/10' : 'border-[#e5005c]/50 bg-[#e5005c]/5'
          }`}>
          {isCheckingImage ? (
            <ActivityIndicator size="small" color="#e5005c" />
          ) : (
            <>
              <View className="mb-1 rounded-full bg-[#e5005c]/15 p-1">
                <Camera color="#e5005c" size={13} />
              </View>
              <Text className="text-center font-jetbrains text-[8px] font-bold leading-3 text-[#e5005c]">
                UPLOAD
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View
          className={`relative h-16 w-16 items-center justify-center overflow-hidden rounded-lg border ${
            isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          {!isLoaded && <ActivityIndicator size="small" color="#e5005c" />}
          <Image
            key={imageUrl}
            source={{ uri: imageUrl }}
            style={{
              width: '100%',
              height: '100%',
              opacity: isLoaded ? 1 : 0,
              position: isLoaded ? 'relative' : 'absolute',
            }}
            resizeMode="cover"
            onLoad={() => setLoadedUri(imageUrl)}
            onError={handleImageError}
          />
          {isLoaded && (
            <View className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5">
              <ZoomIn color="#ffffff" size={9} />
            </View>
          )}
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
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onOpenSearchInBrowser(item)}
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
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          {/* Box Pill */}
          <View className="flex-row items-center gap-1 rounded border border-[#e5005c]/40 bg-[#e5005c]/15 px-1.5 py-0.5">
            <BoxIcon color="#e5005c" size={10} />
            <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">
              BOX: {item.boxNumber}
            </Text>
          </View>

          {/* SKU Pill */}
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

          {/* UPC Pill */}
          <View
            className={`rounded border px-1.5 py-0.5 ${
              isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            <Text className={`font-jetbrains text-[10px] font-semibold ${textSecondaryClass}`}>
              UPC: {item.upc || '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action / Quantity Controls */}
      <View className="items-end justify-center pl-1">
        {mode === 'refill_search' ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onRefill(item)}
            className="flex-row items-center gap-1 rounded-lg bg-[#22c55e] px-2.5 py-1.5 active:bg-[#16a34a]">
            <Package color="#ffffff" size={11} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
              REFILL ({item.qty})
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              onPress={() => onQtyAdjust(item, -1)}
              className={`h-7 w-7 items-center justify-center rounded border ${
                isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-white'
              }`}>
              <Minus color={isDark ? '#fafafa' : '#18181b'} size={12} />
            </TouchableOpacity>

            <View
              className={`min-w-[28px] items-center justify-center rounded border px-1.5 py-1 ${
                isDark
                  ? 'border-[#e5005c]/40 bg-[#e5005c]/15'
                  : 'border-[#e5005c]/30 bg-[#e5005c]/10'
              }`}>
              <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">
                {item.qty}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => onQtyAdjust(item, 1)}
              className={`h-7 w-7 items-center justify-center rounded border ${
                isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-white'
              }`}>
              <Plus color={isDark ? '#fafafa' : '#18181b'} size={12} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3-Second Hold-to-Delete Visual Indicator & Progress Bar */}
      {(isHoldingDelete || isDeletingItem) && (
        <>
          <View
            pointerEvents="none"
            className="absolute right-2.5 top-2 flex-row items-center gap-1 rounded-md bg-[#ef4444] px-2 py-0.5 shadow-sm">
            {isDeletingItem ? (
              <ActivityIndicator size={9} color="#ffffff" />
            ) : (
              <Trash2 color="#ffffff" size={10} />
            )}
            <Text className="font-jetbrains text-[9px] font-bold text-[#ffffff]">
              {isDeletingItem ? 'DELETING...' : 'HOLD 3S TO DELETE...'}
            </Text>
          </View>
          {isHoldingDelete && (
            <View
              pointerEvents="none"
              className="absolute bottom-0 left-0 right-0 h-1 bg-[#ef4444]/20">
              <Animated.View
                style={{ width: holdBarWidth }}
                className="h-full bg-[#ef4444]"
              />
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

function StoreItemSummaryCard({
  item,
  targetBox,
  isDark,
  textPrimaryClass,
  textSecondaryClass,
  uploadedImageUrl,
  isCheckingImage,
  onOpenSearchInBrowser,
  onPressPreviewImage,
  onPressUploadImage,
}: {
  item: { upc?: string; sku?: string; description?: string; imageUrl?: string };
  targetBox: string;
  isDark: boolean;
  textPrimaryClass: string;
  textSecondaryClass: string;
  uploadedImageUrl?: string;
  isCheckingImage?: boolean;
  onOpenSearchInBrowser: (item: { upc?: string; sku?: string; description?: string }) => void;
  onPressPreviewImage: (payload: ItemImagePreviewPayload) => void;
  onPressUploadImage: (item: { upc?: string; sku?: string; description?: string }) => void;
}) {
  const cleanUpc = (item.upc || '').trim();
  const [fallbackTier, setFallbackTier] = useState<'daiso' | 'cloudinary_products' | 'cloudinary_root'>(
    'daiso'
  );
  const [failedUpc, setFailedUpc] = useState<string | null>(() =>
    cleanUpc && failedItemImagesCache.has(cleanUpc) ? cleanUpc : null
  );
  const [failedUploadedUri, setFailedUploadedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);

  const directImage = isUploadedPhoto(item.imageUrl) ? item.imageUrl!.trim() : undefined;
  const candidateUpload =
    directImage || (isUploadedPhoto(uploadedImageUrl) ? uploadedImageUrl : undefined);
  const activeUploadedUrl =
    candidateUpload && failedUploadedUri !== candidateUpload ? candidateUpload : undefined;

  const isImageMissing =
    !activeUploadedUrl &&
    (!cleanUpc || failedUpc === cleanUpc || failedItemImagesCache.has(cleanUpc));
  const isImageAvailable = !isImageMissing;

  const imageUrl = activeUploadedUrl
    ? activeUploadedUrl
    : fallbackTier === 'cloudinary_products'
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/products/${cleanUpc}`
      : fallbackTier === 'cloudinary_root'
        ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/${cleanUpc}`
        : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_400x.jpg`;

  const highResUrl = activeUploadedUrl
    ? activeUploadedUrl
    : fallbackTier === 'cloudinary_products'
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/products/${cleanUpc}`
      : fallbackTier === 'cloudinary_root'
        ? `https://res.cloudinary.com/dqtldfxeh/image/upload/${cleanUpc}`
        : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_1000x.jpg`;

  const isLoaded = loadedUri === imageUrl;

  const handleImageError = () => {
    if (activeUploadedUrl) {
      setFailedUploadedUri(activeUploadedUrl);
    } else if (fallbackTier === 'daiso') {
      setFallbackTier('cloudinary_products');
    } else if (fallbackTier === 'cloudinary_products') {
      setFallbackTier('cloudinary_root');
    } else {
      if (cleanUpc) {
        failedItemImagesCache.add(cleanUpc);
      }
      setFailedUpc(cleanUpc);
    }
  };

  const handleCardPress = () => {
    if (isImageAvailable && isLoaded) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onPressPreviewImage({
        item,
        thumbnailUrl: imageUrl,
        highResUrl,
        boxNumber: targetBox,
      });
    } else if (isImageMissing) {
      onOpenSearchInBrowser(item);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleCardPress}
      className={`mb-3 flex-row items-center gap-3 overflow-hidden rounded-xl border p-3 ${
        isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#fafafa]'
      }`}>
      {/* Thumbnail or Clickable Upload Trigger */}
      {isImageMissing ? (
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={isCheckingImage}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onPressUploadImage(item);
          }}
          className={`h-16 w-16 items-center justify-center rounded-lg border border-dashed px-1 ${
            isDark ? 'border-[#e5005c]/60 bg-[#e5005c]/10' : 'border-[#e5005c]/50 bg-[#e5005c]/5'
          }`}>
          {isCheckingImage ? (
            <ActivityIndicator size="small" color="#e5005c" />
          ) : (
            <>
              <View className="mb-1 rounded-full bg-[#e5005c]/15 p-1">
                <Camera color="#e5005c" size={13} />
              </View>
              <Text className="text-center font-jetbrains text-[8px] font-bold leading-3 text-[#e5005c]">
                UPLOAD
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View
          className={`relative h-16 w-16 items-center justify-center overflow-hidden rounded-lg border ${
            isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          {!isLoaded && <ActivityIndicator size="small" color="#e5005c" />}
          <Image
            key={imageUrl}
            source={{ uri: imageUrl }}
            style={{
              width: '100%',
              height: '100%',
              opacity: isLoaded ? 1 : 0,
              position: isLoaded ? 'relative' : 'absolute',
            }}
            resizeMode="cover"
            onLoad={() => setLoadedUri(imageUrl)}
            onError={handleImageError}
          />
          {isLoaded && (
            <View className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5">
              <ZoomIn color="#ffffff" size={9} />
            </View>
          )}
        </View>
      )}

      {/* Item Details */}
      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-1">
          <Text
            className={`flex-1 font-hanken text-xs font-bold leading-4 ${textPrimaryClass}`}
            numberOfLines={2}>
            {item.description || 'No description available'}
          </Text>
          {!isImageAvailable && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onOpenSearchInBrowser(item)}
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
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          <View className="flex-row items-center gap-1 rounded border border-[#e5005c]/40 bg-[#e5005c]/15 px-1.5 py-0.5">
            <BoxIcon color="#e5005c" size={10} />
            <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">
              BOX: {targetBox}
            </Text>
          </View>

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
              isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <Text className={`font-jetbrains text-[10px] font-semibold ${textSecondaryClass}`}>
              UPC: {item.upc || '—'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ItemImageCaptureModalContent({
  item,
  isDark,
  permission,
  onRequestPermission,
  onClose,
  onUploaded,
}: {
  item: { upc?: string; sku?: string; description?: string; id?: string };
  isDark: boolean;
  permission: ReturnType<typeof useCameraPermissions>[0];
  onRequestPermission: () => void;
  onClose: () => void;
  onUploaded: (result: { secureUrl: string; alreadyExisted: boolean; publicId: string }) => void;
}) {
  const cameraRef = useRef<CameraView | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [canMountCamera, setCanMountCamera] = useState<boolean>(Platform.OS === 'web');

  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const mountTimer = setTimeout(() => {
      setCanMountCamera(true);
    }, 400);
    return () => clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    if (
      !canMountCamera ||
      capturedUri ||
      !permission?.granted ||
      isCameraReady ||
      Platform.OS === 'web'
    ) {
      return;
    }
    const resumeTimer = setTimeout(() => {
      try {
        cameraRef.current?.resumePreview()?.catch(() => {});
      } catch {}
    }, 500);
    return () => clearTimeout(resumeTimer);
  }, [canMountCamera, capturedUri, permission?.granted, isCameraReady]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isUploading) onClose();
      return true;
    });
    return () => sub.remove();
  }, [isUploading, onClose]);

  const isCaptureDisabled =
    !permission?.granted ||
    !canMountCamera ||
    isCapturing ||
    (!isCameraReady && Platform.OS !== 'web');

  const handleCapturePhoto = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        const squareUri = await cropImageToSquare(photo.uri, photo.width, photo.height);
        setCapturedUri(squareUri);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      } else {
        throw new Error('Camera did not return an image. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to capture photo');
      playScanFeedback('error');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  const handleUploadCapturedPhoto = useCallback(async () => {
    if (!capturedUri || isUploading) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const upcCode = (item.upc || '').trim();
      const skuCode = (item.sku || '').trim();
      const result = await uploadReboxImageToCloudinary(
        capturedUri,
        upcCode,
        skuCode,
        setUploadStatusText
      );
      onUploaded(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Upload failed. Check network connection.'
      );
      playScanFeedback('error');
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
    }
  }, [capturedUri, isUploading, item, onUploaded]);

  const handleSafeClose = useCallback(() => {
    try {
      cameraRef.current?.pausePreview()?.catch(() => {});
    } catch {}
    onClose();
  }, [onClose]);

  return (
    <View className="flex-1 items-center justify-center bg-black/85 px-4 py-6">
      <TouchableOpacity
        activeOpacity={1}
        disabled={isUploading}
        onPress={handleSafeClose}
        style={StyleSheet.absoluteFill}
      />

      <View
        className={`max-h-[92%] w-full max-w-sm overflow-hidden rounded-xl border shadow-2xl ${
          isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
        }`}>
        <View
          className={`flex-row items-center justify-between border-b px-4 py-3 ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          <View className="flex-1 flex-row items-center gap-2 pr-2">
            <View className="rounded-lg bg-[#e5005c]/15 p-1.5">
              <Camera color="#e5005c" size={16} />
            </View>
            <View className="flex-1">
              <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                Capture Item Image
              </Text>
              <Text
                className={`font-jetbrains text-[10px] ${textSecondaryClass}`}
                numberOfLines={1}>
                {item.upc
                  ? `UPC: ${item.upc} · PRESET: ${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET}`
                  : item.sku
                    ? `SKU: ${item.sku} · PRESET: ${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET}`
                    : `PRESET: ${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSafeClose}
            disabled={isUploading}
            className={`rounded-lg border p-1.5 ${
              isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            <X color={isDark ? '#fafafa' : '#18181b'} size={18} />
          </TouchableOpacity>
        </View>

        <View
          style={{ aspectRatio: 1 }}
          className={`relative w-full overflow-hidden border-b bg-black ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          {!permission ? (
            <View className="flex-1 items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#e5005c" />
              <Text className="font-jetbrains text-xs text-[#a1a1aa]">Initializing camera...</Text>
            </View>
          ) : !permission.granted ? (
            <View className="flex-1 items-center justify-center gap-3 px-6">
              <AlertTriangle color="#eab308" size={32} />
              <Text className="text-center font-hanken text-xs text-[#fafafa]">
                Camera permission is required to capture product photos.
              </Text>
              <TouchableOpacity
                onPress={onRequestPermission}
                className="rounded-lg bg-[#e5005c] px-4 py-2.5">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                  GRANT CAMERA ACCESS
                </Text>
              </TouchableOpacity>
            </View>
          ) : capturedUri ? (
            <>
              <Image
                source={{ uri: capturedUri }}
                resizeMode="cover"
                className="h-full w-full bg-black"
              />
              <View className="absolute left-3 top-3 rounded-md bg-black/70 px-2.5 py-1">
                <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                  ✓ PHOTO CAPTURED (1:1)
                </Text>
              </View>

              {isUploading && (
                <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center gap-2.5 bg-black/75 px-6">
                  <ActivityIndicator size="large" color="#e5005c" />
                  <Text className="text-center font-jetbrains text-xs font-bold text-[#ffffff]">
                    {uploadStatusText ||
                      `Uploading ${(item.upc || item.sku || '').trim()} (${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET})...`}
                  </Text>
                </View>
              )}
            </>
          ) : !canMountCamera ? (
            <View className="flex-1 items-center justify-center gap-2.5 px-6">
              <ActivityIndicator size="small" color="#e5005c" />
              <Text className="text-center font-jetbrains text-xs text-[#a1a1aa]">
                Preparing camera viewfinder...
              </Text>
            </View>
          ) : (
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                mode="picture"
                enableTorch={torchEnabled}
                onCameraReady={() => setIsCameraReady(true)}
                onMountError={(event) => {
                  setIsCameraReady(false);
                  setErrorMessage(event.message || 'Camera failed to start preview.');
                }}
              />

              {/* 1:1 Framing Corner Guides */}
              <View
                pointerEvents="none"
                className="absolute left-12 top-12 h-10 w-10 border-l-2 border-t-2 border-white/70"
              />
              <View
                pointerEvents="none"
                className="absolute right-12 top-12 h-10 w-10 border-r-2 border-t-2 border-white/70"
              />
              <View
                pointerEvents="none"
                className="absolute bottom-12 left-12 h-10 w-10 border-b-2 border-l-2 border-white/70"
              />
              <View
                pointerEvents="none"
                className="absolute bottom-12 right-12 h-10 w-10 border-b-2 border-r-2 border-white/70"
              />

              <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between">
                <View className="rounded-md bg-black/65 px-2.5 py-1">
                  <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
                    1:1 · CENTER PRODUCT IN FRAME
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setTorchEnabled((prev) => !prev)}
                  activeOpacity={0.8}
                  className={`flex-row items-center gap-1 rounded-lg border px-2.5 py-1.5 ${
                    torchEnabled
                      ? 'border-[#f59e0b] bg-[#f59e0b]/25'
                      : 'border-white/25 bg-black/65'
                  }`}>
                  <Flashlight color={torchEnabled ? '#f59e0b' : '#ffffff'} size={14} />
                  <Text
                    className={`font-jetbrains text-[9px] font-bold ${
                      torchEnabled ? 'text-[#f59e0b]' : 'text-[#ffffff]'
                    }`}>
                    {torchEnabled ? 'FLASH ON' : 'FLASH'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {errorMessage ? (
          <View className="mx-4 mt-2.5 flex-row items-center gap-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 p-2.5">
            <AlertTriangle color="#ef4444" size={15} />
            <Text className="flex-1 font-jetbrains text-[11px] font-semibold text-[#ef4444]">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-2.5 px-4 py-3.5">
          {!capturedUri ? (
            <>
              <TouchableOpacity
                onPress={handleSafeClose}
                activeOpacity={0.8}
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
                onPress={handleCapturePhoto}
                disabled={isCaptureDisabled}
                activeOpacity={0.8}
                className={`flex-[1.6] flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                  isCaptureDisabled ? 'bg-[#e5005c]/45' : 'bg-[#e5005c] active:bg-[#c20050]'
                }`}>
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Camera color="#ffffff" size={16} />
                )}
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                  {isCapturing ? 'CAPTURING...' : 'CAPTURE IMAGE'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => {
                  setCapturedUri(null);
                  setErrorMessage(null);
                }}
                disabled={isUploading}
                activeOpacity={0.8}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-3 ${
                  isDark
                    ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                    : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
                }`}>
                <RotateCcw color={isDark ? '#a1a1aa' : '#71717a'} size={14} />
                <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                  RETAKE
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUploadCapturedPhoto}
                disabled={isUploading}
                activeOpacity={0.8}
                className={`flex-[1.6] flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                  isUploading ? 'bg-[#e5005c]/55' : 'bg-[#e5005c] active:bg-[#c20050]'
                }`}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <CloudUpload color="#ffffff" size={16} />
                )}
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                  {isUploading ? 'UPLOADING...' : 'UPLOAD IMAGE'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function ItemImageZoomModalContent({
  data,
  isDark,
  onClose,
  onOpenStoreModal,
}: {
  data: ItemImagePreviewPayload;
  isDark: boolean;
  onClose: () => void;
  onOpenStoreModal?: (item: any) => void;
}) {
  const { item, thumbnailUrl, highResUrl, boxNumber, qty } = data;
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

  const showHighRes = highResUrl !== thumbnailUrl && failedHighResUri !== highResUrl;
  const isHighResReady = loadedHighResUri === highResUrl;

  return (
    <View className="flex-1 items-center justify-center bg-black/85 px-4 py-6">
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View
        className={`max-h-[92%] w-full max-w-md overflow-hidden rounded-xl border shadow-2xl ${
          isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
        }`}>
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
                {item.sku ? `SKU: ${item.sku}` : item.upc ? `UPC: ${item.upc}` : 'Rebox Item'}
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
                onPress={() => applyZoom(zoomScale - 0.5)}
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
                }}
                className="rounded bg-white/15 px-2 py-1">
                <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
                  {zoomScale.toFixed(1)}x
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => applyZoom(zoomScale + 0.5)}
                disabled={zoomScale >= 4}
                className={`h-7 w-7 items-center justify-center rounded ${
                  zoomScale >= 4 ? 'opacity-40' : 'active:bg-white/20'
                }`}>
                <ZoomIn color="#ffffff" size={14} />
              </TouchableOpacity>

              {zoomScale > 1 && (
                <TouchableOpacity
                  onPress={() => applyZoom(1, { x: 0, y: 0 })}
                  className="ml-0.5 h-7 w-7 items-center justify-center rounded bg-[#e5005c]">
                  <RotateCcw color="#ffffff" size={13} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <ScrollView className="max-h-72 px-4 pt-3.5" showsVerticalScrollIndicator={false}>
          <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
            {boxNumber ? (
              <View className="rounded border border-[#e5005c]/40 bg-[#e5005c]/15 px-2 py-0.5">
                <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                  BOX: {boxNumber}
                </Text>
              </View>
            ) : null}

            {typeof qty === 'number' && qty > 0 ? (
              <View className="rounded border border-[#22c55e]/40 bg-[#22c55e]/15 px-2 py-0.5">
                <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                  AVAILABLE: {qty} UNITS
                </Text>
              </View>
            ) : null}
          </View>

          <Text className={`mb-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
            {item.description || 'No description available'}
          </Text>

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
          </View>
        </ScrollView>

        <View
          className={`flex-row items-center gap-2.5 border-t px-4 py-3 ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center rounded-lg border py-3 ${
              isDark
                ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
            }`}>
            <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>CLOSE</Text>
          </TouchableOpacity>

          {onOpenStoreModal && (
            <TouchableOpacity
              onPress={() => onOpenStoreModal(item)}
              activeOpacity={0.8}
              className="flex-1 items-center justify-center rounded-lg bg-[#e5005c] py-3 active:bg-[#c20050]">
              <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">ADD TO BOX</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ReboxScannerScreen({
  navigation: propNavigation,
  route: propRoute,
}: {
  navigation?: any;
  route?: { params?: { boxNumber?: string; initialTab?: 'current_box' | 'refill_search' | 'all_boxes' } };
} = {}) {
  const contextNavigation = useContext(NavigationContext);
  const hookRoute = useRoute<any>();
  const navigation = propNavigation || contextNavigation;
  const routeParams = propRoute?.params || hookRoute?.params || {};
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { storeCode, storeName } = useAuth();
  const storeFilter = useMemo(
    () => (storeCode || storeName ? { storeCode, storeName } : undefined),
    [storeCode, storeName]
  );

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const tabBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerCardBgClass = isDark
    ? 'bg-[#131316] border-[#3f3f46]'
    : 'bg-[#fafafa] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';
  const footerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';

  const [permission, requestPermission] = useCameraPermissions();

  type TabType = 'current_box' | 'refill_search' | 'all_boxes';
  type SortOption = 'default' | 'qty_desc' | 'qty_asc' | 'alpha_asc' | 'alpha_desc';

  const [activeTab, setActiveTab] = useState<TabType>(routeParams.initialTab || 'current_box');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showSortModal, setShowSortModal] = useState(false);

  // Active Storage Box Number State
  const [currentBoxNumber, setCurrentBoxNumber] = useState<string>(
    routeParams.boxNumber ? normalizeBoxNumber(routeParams.boxNumber) : 'BOX-01'
  );
  const [boxSummaries, setBoxSummaries] = useState<ReboxBoxSummary[]>([]);
  const [allReboxItems, setAllReboxItems] = useState<ReboxItem[]>([]);
  const [manifestItems, setManifestItems] = useState<ItemManifestRecord[]>([]);
  const [openSheetCatalog, setOpenSheetCatalog] = useState<ProductItem[]>([]);
  const [uploadedItemImages, setUploadedItemImages] = useState<Record<string, string>>({});
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Box Selector / Entry Modal State
  const [showBoxSelectorModal, setShowBoxSelectorModal] = useState(false);
  const [customBoxInput, setCustomBoxInput] = useState('');

  // Item Storing Modal State (when scanned or manually entered)
  const [storeModalItem, setStoreModalItem] = useState<{
    sku: string;
    upc: string;
    description: string;
    imageUrl?: string;
  } | null>(null);
  const [storeQtyInput, setStoreQtyInput] = useState<string>('1');
  const [storeTargetBox, setStoreTargetBox] = useState<string>(
    routeParams.boxNumber ? normalizeBoxNumber(routeParams.boxNumber) : 'BOX-01'
  );

  // Refill Selling Area Modal State (taking units from box)
  const [refillModalItem, setRefillModalItem] = useState<ReboxItem | null>(null);
  const [refillQtyInput, setRefillQtyInput] = useState<string>('1');

  // Last Scanned feedback & Manual entry
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Image Zoom & Capture Modals
  const [imageZoomModal, setImageZoomModal] = useState<ItemImagePreviewPayload | null>(null);
  const [uploadImageModalItem, setUploadImageModalItem] = useState<any | null>(null);
  const [checkingImageKey, setCheckingImageKey] = useState<string | null>(null);

  // Full Screen Tabs / Bluetooth Scanner mode
  const [isFullScreenTabs, setIsFullScreenTabs] = useState(false);
  const [isBluetoothScannerActive, setIsBluetoothScannerActive] = useState(false);
  const [bluetoothInput, setBluetoothInput] = useState('');
  const bluetoothInputRef = useRef<TextInput>(null);
  const liveBufferRef = useRef('');
  const scanBufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  // Hold-to-scan state
  const [isHoldScanning, setIsHoldScanning] = useState(false);
  const isHoldScanningRef = useRef(false);
  const scannerCameraRef = useRef<CameraView | null>(null);
  const [laserAnim] = useState(() => new Animated.Value(0));
  const scanCooldown = useRef(false);

  // Notification Toast
  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isHoldScanningRef.current = isHoldScanning;
  }, [isHoldScanning]);

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

  // Laser line animation
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
      if (animLoop) animLoop.stop();
    };
  }, [isHoldScanning, laserAnim]);

  // Request camera permission if not granted
  useEffect(() => {
    if (!permission || (!permission.granted && permission.canAskAgain)) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Sync active box from route params or AsyncStorage
  useEffect(() => {
    if (routeParams.boxNumber && String(routeParams.boxNumber).trim()) {
      const normalized = normalizeBoxNumber(String(routeParams.boxNumber));
      if (normalized) {
        setActiveReboxBox(normalized, storeFilter).catch(() => {});
      }
      return;
    }

    let cancelled = false;
    getActiveReboxBox(storeFilter).then((savedBox) => {
      if (!cancelled && savedBox && savedBox.trim()) {
        setCurrentBoxNumber(savedBox.trim());
        setStoreTargetBox(savedBox.trim());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [routeParams.boxNumber, storeFilter]);

  // Preload OpenSheet catalog in background for instant barcode lookup
  useEffect(() => {
    let mounted = true;
    fetchOpenSheetCatalog()
      .then((items) => {
        if (mounted && Array.isArray(items) && items.length > 0) {
          setOpenSheetCatalog(items);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Reload Supabase rebox items
  const reloadData = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const items = await fetchReboxItems({ storeCode, storeName });
      const summaries = await fetchReboxBoxes(items, storeFilter);
      setAllReboxItems(items);
      setBoxSummaries(summaries);
    } catch (err: any) {
      showNotification(
        'error',
        'DATABASE SYNC ERROR',
        err.message || 'Could not load from Supabase'
      );
    } finally {
      setIsLoadingItems(false);
    }
  }, [showNotification, storeCode, storeName, storeFilter]);

  // Load manifest CSV items & uploaded Cloudinary image links
  const loadStoredData = useCallback(async () => {
    try {
      const [storedManifest, storedImages] = await Promise.all([
        AsyncStorage.getItem(MANIFEST_ITEMS_KEY),
        AsyncStorage.getItem(UPLOADED_ITEM_IMAGES_KEY),
      ]);
      if (storedManifest) {
        setManifestItems(JSON.parse(storedManifest) as ItemManifestRecord[]);
      }
      if (storedImages) {
        setUploadedItemImages(JSON.parse(storedImages) as Record<string, string>);
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadData();
      loadStoredData();
    }, [reloadData, loadStoredData])
  );

  // Memoized index of OpenSheet catalog items by normalized codes for instant O(1) lookup
  const catalogItemsByCode = useMemo(() => {
    const map = new Map<string, ProductItem>();
    for (const it of openSheetCatalog) {
      const normSku = normalizeLookupCode(it.sku);
      const normUpc = normalizeLookupCode(it.upc);
      if (normSku && !map.has(normSku)) map.set(normSku, it);
      if (normUpc && !map.has(normUpc)) map.set(normUpc, it);
      if (it.sku && !map.has(it.sku.toUpperCase())) map.set(it.sku.toUpperCase(), it);
      if (it.upc && !map.has(it.upc.toUpperCase())) map.set(it.upc.toUpperCase(), it);
    }
    return map;
  }, [openSheetCatalog]);

  // Memoized index of manifest items by normalized codes for instant lookup
  const manifestItemsByCode = useMemo(() => {
    const map = new Map<string, ItemManifestRecord>();
    for (const it of manifestItems) {
      const normSku = normalizeLookupCode(it.sku);
      const normUpc = normalizeLookupCode(it.upc);
      const normTrf = normalizeLookupCode(it.trf);
      const normCid = normalizeLookupCode(it.cid);
      if (normSku && !map.has(normSku)) map.set(normSku, it);
      if (normUpc && !map.has(normUpc)) map.set(normUpc, it);
      if (normTrf && !map.has(normTrf)) map.set(normTrf, it);
      if (normCid && !map.has(normCid)) map.set(normCid, it);
      if (it.sku && !map.has(it.sku.toUpperCase())) map.set(it.sku.toUpperCase(), it);
      if (it.upc && !map.has(it.upc.toUpperCase())) map.set(it.upc.toUpperCase(), it);
    }
    return map;
  }, [manifestItems]);

  // Enriched Rebox items merging Supabase data with OpenSheet & Manifest details & cached images
  const enrichedAllItems = useMemo(() => {
    return allReboxItems.map((item) => {
      const normSku = normalizeLookupCode(item.sku);
      const normUpc = normalizeLookupCode(item.upc);

      const openSheetMatch =
        catalogItemsByCode.get(normSku) ||
        catalogItemsByCode.get(normUpc) ||
        (item.sku ? catalogItemsByCode.get(item.sku.toUpperCase()) : undefined) ||
        (item.upc ? catalogItemsByCode.get(item.upc.toUpperCase()) : undefined);

      const manifestMatch =
        manifestItemsByCode.get(normSku) ||
        manifestItemsByCode.get(normUpc) ||
        (item.sku ? manifestItemsByCode.get(item.sku.toUpperCase()) : undefined) ||
        (item.upc ? manifestItemsByCode.get(item.upc.toUpperCase()) : undefined);

      const enrichedSku = item.sku || openSheetMatch?.sku || manifestMatch?.sku || '';
      const enrichedUpc = item.upc || openSheetMatch?.upc || manifestMatch?.upc || '';
      const enrichedDescription =
        item.description || openSheetMatch?.description || manifestMatch?.description || '';

      return {
        ...item,
        sku: enrichedSku,
        upc: enrichedUpc,
        description: enrichedDescription,
      };
    });
  }, [allReboxItems, manifestItemsByCode, catalogItemsByCode]);

  const itemsInCurrentBox = useMemo(() => {
    return enrichedAllItems.filter(
      (item) => item.boxNumber.toUpperCase() === currentBoxNumber.toUpperCase()
    );
  }, [enrichedAllItems, currentBoxNumber]);

  /**
   * Open the selected item in Expo WebBrowser searching via Google Images with its UPC code.
   */
  const handleOpenItemSearchInBrowser = useCallback(
    async (item: { upc?: string; sku?: string; description?: string }) => {
      const upc = (item.upc || item.sku || '').trim();
      if (!upc) {
        showNotification(
          'warning',
          'NO UPC CODE',
          'This item does not have a UPC or SKU code to search.'
        );
        return;
      }

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

  /**
   * Check first if an image already exists on Daiso CDN / Cloudinary for this UPC
   * before opening the camera upload modal.
   */
  const handleRequestUploadImage = useCallback(
    async (item: { upc?: string; sku?: string; description?: string; id?: string }) => {
      const cleanUpc = (item.upc || '').trim();
      const cleanSku = (item.sku || '').trim();
      const lookupCode = cleanUpc || cleanSku;
      if (!lookupCode) {
        Alert.alert(
          'Missing UPC Code',
          'This item needs a UPC code before uploading a product image.'
        );
        return;
      }

      const itemKey = getItemImageKey({ sku: cleanSku, upc: cleanUpc, id: item.id });
      setCheckingImageKey(itemKey);
      try {
        const existingUrl = await checkExistingProductImage(lookupCode);
        if (existingUrl) {
          if (cleanUpc) failedItemImagesCache.delete(cleanUpc);
          setUploadedItemImages((prev) => {
            const next = { ...prev, [itemKey]: existingUrl };
            if (cleanUpc) next[`upc:${cleanUpc}`] = existingUrl;
            if (cleanSku) next[`sku:${cleanSku}`] = existingUrl;
            AsyncStorage.setItem(UPLOADED_ITEM_IMAGES_KEY, JSON.stringify(next)).catch(() => {});
            return next;
          });
          showNotification(
            'success',
            '✓ IMAGE ALREADY AVAILABLE',
            `Loaded existing image for UPC ${lookupCode}.`
          );
          playScanFeedback('success');
          return;
        }
        // Confirmed no image exists -> open camera capture modal
        setUploadImageModalItem(item);
      } finally {
        setCheckingImageKey(null);
      }
    },
    [showNotification]
  );

  const changeCurrentBox = (boxNumber: string) => {
    const clean = normalizeBoxNumber(boxNumber);
    if (!clean) return;
    setCurrentBoxNumber(clean);
    setStoreTargetBox(clean);
    setActiveReboxBox(clean, storeFilter)
      .then(() => fetchReboxBoxes(allReboxItems, storeFilter))
      .then((summaries) => setBoxSummaries(summaries))
      .catch(() => {});
    setShowBoxSelectorModal(false);
    showNotification('info', 'ACTIVE BOX SWITCHED', `Now scanning items into ${clean}`);
  };

  const refocusBluetoothInput = useCallback(() => {
    if (isFullScreenTabs && isBluetoothScannerActive) {
      setTimeout(() => {
        bluetoothInputRef.current?.focus();
      }, 150);
    }
  }, [isFullScreenTabs, isBluetoothScannerActive]);

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

  // Swipe up/down PanResponder
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
            setIsFullScreenTabs(true);
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          } else if (gestureState.dy > 20) {
            setIsFullScreenTabs(false);
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          }
        },
      }),
    []
  );

  // Handle scanned code (lookup item and open store modal)
  const handleScan = useCallback(
    async (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      const norm = normalizeLookupCode(clean);

      // 1. Direct memory lookup in OpenSheet catalog or manifest items
      const openSheetMatch =
        catalogItemsByCode.get(norm) ||
        catalogItemsByCode.get(clean.toUpperCase());

      const manifestMatch =
        manifestItemsByCode.get(norm) ||
        manifestItemsByCode.get(clean.toUpperCase());

      if (openSheetMatch || manifestMatch) {
        const resolvedSku = openSheetMatch?.sku || manifestMatch?.sku || clean;
        const resolvedUpc = openSheetMatch?.upc || manifestMatch?.upc || '';
        const resolvedDesc = openSheetMatch?.description || manifestMatch?.description || '';

        const imageKey = getItemImageKey({ sku: resolvedSku, upc: resolvedUpc });
        const candidateImg =
          uploadedItemImages[imageKey] ||
          (resolvedUpc ? uploadedItemImages[`upc:${resolvedUpc}`] : undefined) ||
          (resolvedSku ? uploadedItemImages[`sku:${resolvedSku}`] : undefined);
        const cachedImg = isUploadedPhoto(candidateImg) ? candidateImg : undefined;

        setStoreModalItem({
          sku: resolvedSku,
          upc: resolvedUpc,
          description: resolvedDesc,
          imageUrl: cachedImg,
        });
        setStoreQtyInput('1');
        setStoreTargetBox(currentBoxNumber);
        playScanFeedback('success');
        return;
      }

      // 2. Storage & OpenSheet lookupItemDetails fallback
      try {
        const details = await lookupItemDetails(clean);
        if (details && (details.description || details.upc || details.sku !== clean)) {
          setStoreModalItem(details);
          setStoreQtyInput('1');
          setStoreTargetBox(currentBoxNumber);
          playScanFeedback('success');
        } else {
          const isUpc = /^\d{8,14}$/.test(clean);
          setStoreModalItem({
            sku: clean,
            upc: isUpc ? clean : '',
            description: details?.description || '',
            imageUrl: details?.imageUrl,
          });
          setStoreQtyInput('1');
          setStoreTargetBox(currentBoxNumber);
          playScanFeedback('warning');
        }
      } catch {
        const isUpc = /^\d{8,14}$/.test(clean);
        setStoreModalItem({
          sku: clean,
          upc: isUpc ? clean : '',
          description: '',
          imageUrl: undefined,
        });
        setStoreQtyInput('1');
        setStoreTargetBox(currentBoxNumber);
      }
    },
    [currentBoxNumber, catalogItemsByCode, manifestItemsByCode, uploadedItemImages]
  );

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

  const submitManual = () => {
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput('');
      setShowManual(false);
      refocusBluetoothInput();
    }
  };

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

  // Save Scanned Item to Supabase
  const confirmSaveToBox = async () => {
    if (!storeModalItem) return;
    const qty = parseInt(storeQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity of 1 or greater.');
      return;
    }
    const targetBox = storeTargetBox.trim();
    if (!targetBox) {
      Alert.alert('Missing Box Number', 'Please enter a box number.');
      return;
    }

    setIsSavingToSupabase(true);
    try {
      const saved = await saveReboxItem({
        boxNumber: targetBox,
        storeCode,
        storeName,
        sku: storeModalItem.sku,
        upc: storeModalItem.upc,
        description: storeModalItem.description,
        qty,
      });

      setLastScanned(`${saved.sku || saved.upc} (+${qty})`);
      setStoreModalItem(null);
      showNotification(
        'success',
        '✓ SAVED TO SUPABASE',
        `Stored ${qty} units of "${saved.sku || saved.upc}" into ${targetBox}.`
      );
      playScanFeedback('success');
      await reloadData();
    } catch (err: any) {
      Alert.alert('Supabase Error', err.message || 'Failed to save item to database.');
      playScanFeedback('error');
    } finally {
      setIsSavingToSupabase(false);
      refocusBluetoothInput();
    }
  };

  // Refill Selling Area (taking items from box)
  const confirmRefillItem = async () => {
    if (!refillModalItem) return;
    const qty = parseInt(refillQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Refill QTY', 'Please enter a valid quantity to refill.');
      return;
    }
    if (qty > refillModalItem.qty) {
      Alert.alert(
        'Exceeds Stored Quantity',
        `Only ${refillModalItem.qty} units are stored in ${refillModalItem.boxNumber}.`
      );
      return;
    }

    try {
      const result = await refillItemFromBox(refillModalItem.id, qty);
      const itemName = refillModalItem.sku || refillModalItem.upc || 'Item';
      if (result.deleted) {
        showNotification(
          'info',
          'BOX EMPTIED',
          `Refilled all ${qty} units of "${itemName}" from ${refillModalItem.boxNumber}.`
        );
      } else {
        showNotification(
          'success',
          '✓ REFILLED TO SELLING AREA',
          `Took ${qty} units of "${itemName}". ${result.remainingQty} units remain in ${refillModalItem.boxNumber}.`
        );
      }
      playScanFeedback('success');
      setRefillModalItem(null);
      await reloadData();
    } catch (err: any) {
      Alert.alert('Refill Error', err.message || 'Failed to update rebox record.');
      playScanFeedback('error');
    }
  };

  // Adjust Quantity Inline
  const handleInlineQtyAdjust = async (item: ReboxItem, delta: number) => {
    const nextQty = item.qty + delta;
    try {
      await updateReboxItemQty(item.id, nextQty);
      await reloadData();
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    } catch (err: any) {
      showNotification('error', 'UPDATE FAILED', err.message || 'Failed to update quantity');
    }
  };

  // Remove Item from Box
  const handleHoldDeleteItem = async (item: ReboxItem) => {
    try {
      await deleteReboxItem(item.id, storeFilter);
      playScanFeedback('success');
      showNotification(
        'info',
        'ITEM DELETED',
        `Deleted "${item.description || item.sku || item.upc}" from ${item.boxNumber}.`
      );
      await reloadData();
    } catch (err: any) {
      playScanFeedback('error');
      Alert.alert('Delete Failed', err?.message || 'Failed to delete item.');
    }
  };

  // Filtered & Sorted Displays
  const displayItems = useMemo(() => {
    let sourceList: ReboxItem[] = [];
    if (activeTab === 'current_box') {
      sourceList = itemsInCurrentBox;
    } else {
      sourceList = enrichedAllItems;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qNorm = normalizeLookupCode(q);
      sourceList = sourceList.filter((item) => {
        const s = (item.sku || '').toLowerCase();
        const u = (item.upc || '').toLowerCase();
        const d = (item.description || '').toLowerCase();
        const b = (item.boxNumber || '').toLowerCase();
        if (s.includes(q) || u.includes(q) || d.includes(q) || b.includes(q)) return true;
        if (qNorm) {
          const sNorm = normalizeLookupCode(item.sku);
          const uNorm = normalizeLookupCode(item.upc);
          const bNorm = normalizeLookupCode(item.boxNumber);
          if (sNorm.includes(qNorm) || uNorm.includes(qNorm) || bNorm.includes(qNorm)) return true;
        }
        return false;
      });
    }

    const sorted = [...sourceList];
    if (sortBy === 'qty_desc') return sorted.sort((a, b) => b.qty - a.qty);
    if (sortBy === 'qty_asc') return sorted.sort((a, b) => a.qty - b.qty);
    if (sortBy === 'alpha_asc')
      return sorted.sort((a, b) =>
        (a.sku || a.description || '').localeCompare(b.sku || b.description || '')
      );
    if (sortBy === 'alpha_desc')
      return sorted.sort((a, b) =>
        (b.sku || b.description || '').localeCompare(a.sku || a.description || '')
      );
    return sorted;
  }, [activeTab, enrichedAllItems, itemsInCurrentBox, searchQuery, sortBy]);

  // Download Rebox Items as PDF with Product Images
  const runPdfExport = async (
    candidateItems: ReboxItem[],
    scopedBox: string | undefined,
    action: 'save_to_device' | 'share'
  ) => {
    setIsExportingPdf(true);
    try {
      const normalizedImagesMap: Record<string, string> = { ...uploadedItemImages };
      for (const it of candidateItems) {
        const key = getItemImageKey({ sku: it.sku, upc: it.upc, id: it.id });
        const mapped = uploadedItemImages[key];
        if (mapped) {
          if (it.upc) normalizedImagesMap[`upc:${it.upc.trim()}`] = mapped;
          if (it.sku) normalizedImagesMap[`sku:${it.sku.trim()}`] = mapped;
          normalizedImagesMap[`${it.sku}_${it.upc}`] = mapped;
        }
      }

      const result = await downloadReboxPdf({
        items: candidateItems,
        boxNumber: scopedBox || null,
        storeCode,
        storeName,
        uploadedItemImages: normalizedImagesMap,
        action,
      });

      if (result.cancelled) return;

      playScanFeedback('success');
      showNotification(
        'success',
        result.savedToDevice ? 'PDF DOWNLOADED TO PHONE' : 'PDF READY TO SHARE / PRINT',
        `${result.savedToDevice ? 'Saved' : 'Exported'} ${result.itemCount} SKUs (${result.imagesEmbedded} photos) — ${result.fileName}`
      );
    } catch (err: any) {
      playScanFeedback('error');
      showNotification(
        'error',
        'PDF EXPORT FAILED',
        err?.message || 'Failed to generate Rebox PDF report.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadPdf = (specificBoxNumber?: string) => {
    if (isExportingPdf) return;

    const scopedBox = specificBoxNumber
      ? normalizeBoxNumber(specificBoxNumber)
      : activeTab === 'current_box'
        ? currentBoxNumber
        : undefined;

    const candidateItems = specificBoxNumber
      ? enrichedAllItems.filter(
          (it) => normalizeBoxNumber(it.boxNumber).toUpperCase() === scopedBox?.toUpperCase()
        )
      : activeTab === 'all_boxes'
        ? enrichedAllItems
        : displayItems;

    if (candidateItems.length === 0) {
      playScanFeedback('warning');
      showNotification(
        'warning',
        'NO ITEMS TO EXPORT',
        scopedBox
          ? `No stored items found in ${scopedBox} to export as PDF.`
          : 'No matching stored items available to export as PDF.'
      );
      return;
    }

    if (Platform.OS === 'android') {
      Alert.alert(
        scopedBox ? `Export ${scopedBox} PDF` : 'Export Rebox PDF',
        `Download ${candidateItems.length} ${candidateItems.length === 1 ? 'item' : 'items'} with product images as a PDF:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share / Print',
            onPress: () => {
              runPdfExport(candidateItems, scopedBox, 'share');
            },
          },
          {
            text: 'Save to Phone',
            onPress: () => {
              runPdfExport(candidateItems, scopedBox, 'save_to_device');
            },
          },
        ]
      );
      return;
    }

    runPdfExport(candidateItems, scopedBox, 'share');
  };

  const currentBoxUnits = itemsInCurrentBox.reduce((sum, item) => sum + item.qty, 0);
  const totalStockroomUnits = allReboxItems.reduce((sum, item) => sum + item.qty, 0);

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
                Manual Barcode / Item Entry
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
              keyboardType="number-pad"
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Enter SKU or UPC barcode..."
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
              <Text className="font-jetbrains text-sm font-bold text-[#ffffff]">
                LOOKUP & STORE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Box Number Switch / Selector Modal */}
      <Modal visible={showBoxSelectorModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View
            className={`max-h-[85%] w-full max-w-sm rounded-xl border p-5 shadow-2xl ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <BoxIcon color="#e5005c" size={20} />
                <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                  Select Storage Box
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBoxSelectorModal(false)}>
                <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
              </TouchableOpacity>
            </View>

            <Text className={`mb-3 font-hanken text-xs ${textSecondaryClass}`}>
              Enter a box number or select an existing box in the stockroom:
            </Text>

            <View className="mb-3 flex-row items-center gap-2">
              <TextInput
                value={customBoxInput}
                onChangeText={setCustomBoxInput}
                placeholder="Enter box number (e.g. BOX-05)..."
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                autoCapitalize="characters"
                className={`h-11 flex-1 rounded-lg border px-3 font-jetbrains text-xs font-bold ${
                  isDark
                    ? 'border-[#3f3f46] bg-[#131316] text-[#fafafa]'
                    : 'border-[#d4d4d8] bg-[#fafafa] text-[#18181b]'
                }`}
              />
              <TouchableOpacity
                onPress={() => {
                  if (customBoxInput.trim()) {
                    changeCurrentBox(customBoxInput.trim());
                    setCustomBoxInput('');
                  }
                }}
                className="h-11 items-center justify-center rounded-lg bg-[#e5005c] px-4">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">USE</Text>
              </TouchableOpacity>
            </View>

            <Text
              className={`mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
              Existing Boxes in Stockroom ({boxSummaries.length}):
            </Text>

            <FlatList
              data={boxSummaries}
              keyExtractor={(box) => box.boxNumber}
              className="max-h-56"
              renderItem={({ item: box }) => {
                const isSelected = box.boxNumber === currentBoxNumber;
                return (
                  <TouchableOpacity
                    onPress={() => changeCurrentBox(box.boxNumber)}
                    className={`mb-2 flex-row items-center justify-between rounded-lg border p-3 ${
                      isSelected
                        ? 'border-[#e5005c] bg-[#e5005c]/15'
                        : isDark
                          ? 'border-[#3f3f46] bg-[#131316]'
                          : 'border-[#e4e4e7] bg-[#fafafa]'
                    }`}>
                    <View className="flex-row items-center gap-2">
                      <BoxIcon
                        color={isSelected ? '#e5005c' : isDark ? '#a1a1aa' : '#71717a'}
                        size={16}
                      />
                      <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
                        {box.boxNumber}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="rounded bg-[#e5005c]/10 px-2 py-0.5">
                        <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                          {box.totalUnits} Units ({box.itemCount} SKUs)
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

      {/* Sort Options Modal */}
      <Modal visible={showSortModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View
            className={`w-full rounded-xl border p-5 shadow-2xl ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ArrowUpDown color="#e5005c" size={20} />
                <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                  Sort Rebox Items
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
              </TouchableOpacity>
            </View>

            {[
              { id: 'default', label: 'Default / Recently Stored' },
              { id: 'qty_desc', label: 'Quantity (Highest First)' },
              { id: 'qty_asc', label: 'Quantity (Lowest First)' },
              { id: 'alpha_asc', label: 'Alphabetical (A → Z by SKU/Desc)' },
              { id: 'alpha_desc', label: 'Alphabetical (Z → A by SKU/Desc)' },
            ].map((option) => {
              const isSelected = sortBy === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setSortBy(option.id as SortOption);
                    setShowSortModal(false);
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
                    className={`font-jetbrains text-xs font-semibold ${
                      isSelected ? 'text-[#e5005c]' : textPrimaryClass
                    }`}>
                    {option.label}
                  </Text>
                  {isSelected && <CheckCircle color="#e5005c" size={16} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Item Image Zoom Modal */}
      <Modal
        visible={imageZoomModal !== null && storeModalItem === null && refillModalItem === null}
        transparent
        animationType="fade"
        onRequestClose={() => setImageZoomModal(null)}>
        {imageZoomModal && (
          <ItemImageZoomModalContent
            key={imageZoomModal.item.id || imageZoomModal.item.sku}
            data={imageZoomModal}
            isDark={isDark}
            onClose={() => setImageZoomModal(null)}
          />
        )}
      </Modal>

      {/* Store Item in Box Modal (When Scanned) */}
      <Modal
        visible={storeModalItem !== null && uploadImageModalItem === null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (imageZoomModal) {
            setImageZoomModal(null);
          } else {
            setStoreModalItem(null);
            refocusBluetoothInput();
          }
        }}>
        {imageZoomModal && storeModalItem ? (
          <ItemImageZoomModalContent
            key={imageZoomModal.item.id || imageZoomModal.item.sku}
            data={imageZoomModal}
            isDark={isDark}
            onClose={() => setImageZoomModal(null)}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-black/70 px-6">
            <View
              className={`max-h-[92%] w-full rounded-xl border p-5 shadow-2xl ${
                isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
              }`}>
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="rounded-lg bg-[#e5005c]/10 p-2">
                    <Boxes color="#e5005c" size={18} />
                  </View>
                  <View>
                    <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                      Store Item in Box
                    </Text>
                    <Text className={`font-jetbrains text-[10px] text-[#e5005c]`}>
                      STORAGE BOX: {storeTargetBox}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setStoreModalItem(null);
                    refocusBluetoothInput();
                  }}>
                  <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                </TouchableOpacity>
              </View>

              {storeModalItem && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Item Summary Card matching scanningBox.tsx */}
                  <StoreItemSummaryCard
                    item={storeModalItem}
                    targetBox={storeTargetBox}
                    isDark={isDark}
                    textPrimaryClass={textPrimaryClass}
                    textSecondaryClass={textSecondaryClass}
                    uploadedImageUrl={
                      uploadedItemImages[
                        getItemImageKey({
                          sku: storeModalItem.sku,
                          upc: storeModalItem.upc,
                        })
                      ]
                    }
                    isCheckingImage={
                      checkingImageKey ===
                      getItemImageKey({
                        sku: storeModalItem.sku,
                        upc: storeModalItem.upc,
                      })
                    }
                    onOpenSearchInBrowser={handleOpenItemSearchInBrowser}
                    onPressPreviewImage={(payload) => setImageZoomModal(payload)}
                    onPressUploadImage={(target) => handleRequestUploadImage(target)}
                  />

                  {/* Target Physical Storage Box */}
                  <Text
                    className={`mb-1 font-jetbrains text-[11px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                    PHYSICAL BOX NUMBER:
                  </Text>
                  <View
                    className={`mb-3 flex-row items-center rounded-lg border px-3 ${
                      isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#d4d4d8] bg-[#fafafa]'
                    }`}>
                    <BoxIcon color="#e5005c" size={16} />
                    <TextInput
                      value={storeTargetBox}
                      onChangeText={setStoreTargetBox}
                      placeholder="e.g. BOX-01..."
                      placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                      autoCapitalize="characters"
                      className={`h-11 flex-1 px-2.5 font-jetbrains text-xs font-bold ${textPrimaryClass}`}
                    />
                  </View>

                  {/* Quick Pack Presets */}
                  <Text
                    className={`mb-1.5 font-jetbrains text-[11px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                    QUICK QUANTITY PRESETS:
                  </Text>
                  <View className="mb-3 flex-row flex-wrap gap-1.5">
                    {[1, 6, 10, 12, 18, 24, 48].map((preset) => {
                      const isSelected = storeQtyInput === String(preset);
                      return (
                        <TouchableOpacity
                          key={preset}
                          onPress={() => {
                            setStoreQtyInput(String(preset));
                            try {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch {}
                          }}
                          className={`rounded-lg border px-3 py-1.5 ${
                            isSelected
                              ? 'border-[#e5005c] bg-[#e5005c]'
                              : isDark
                                ? 'border-[#3f3f46] bg-[#2a2a2d]'
                                : 'border-[#d4d4d8] bg-[#f4f4f5]'
                          }`}>
                          <Text
                            className={`font-jetbrains text-xs font-bold ${
                              isSelected ? 'text-[#ffffff]' : textPrimaryClass
                            }`}>
                            +{preset}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Quantity Stepper */}
                  <Text
                    className={`mb-1.5 font-jetbrains text-xs font-semibold ${textPrimaryClass}`}>
                    UNITS TO STORE:
                  </Text>
                  <View className="mb-4 flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        const current = parseInt(storeQtyInput, 10) || 0;
                        setStoreQtyInput(String(Math.max(1, current - 1)));
                      }}
                      className={`h-11 w-11 items-center justify-center rounded-lg border ${
                        isDark
                          ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                          : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
                      }`}>
                      <Minus color={isDark ? '#fafafa' : '#18181b'} size={18} />
                    </TouchableOpacity>

                    <TextInput
                      value={storeQtyInput}
                      onChangeText={setStoreQtyInput}
                      keyboardType="number-pad"
                      className={`h-11 flex-1 rounded-lg border text-center font-jetbrains text-base font-bold ${
                        isDark
                          ? 'border-[#3f3f46] bg-[#131316] text-[#fafafa]'
                          : 'border-[#d4d4d8] bg-[#fafafa] text-[#18181b]'
                      }`}
                    />

                    <TouchableOpacity
                      onPress={() => {
                        const current = parseInt(storeQtyInput, 10) || 0;
                        setStoreQtyInput(String(current + 1));
                      }}
                      className={`h-11 w-11 items-center justify-center rounded-lg border ${
                        isDark
                          ? 'border-[#3f3f46] bg-[#2a2a2d] active:bg-[#3f3f46]'
                          : 'border-[#d4d4d8] bg-[#f4f4f5] active:bg-[#e4e4e7]'
                      }`}>
                      <Plus color={isDark ? '#fafafa' : '#18181b'} size={18} />
                    </TouchableOpacity>
                  </View>

                  {/* Actions */}
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={() => {
                        setStoreModalItem(null);
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
                      onPress={confirmSaveToBox}
                      disabled={isSavingToSupabase}
                      activeOpacity={0.8}
                      className="flex-1 items-center justify-center rounded-lg bg-[#e5005c] py-3 active:bg-[#c20050]">
                      {isSavingToSupabase ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                          SAVE TO BOX
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* Refill Selling Area Modal */}
      <Modal
        visible={refillModalItem !== null && uploadImageModalItem === null}
        transparent
        animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View
            className={`w-full max-w-sm rounded-xl border p-5 shadow-2xl ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-[#22c55e]/10 p-2">
                  <Package color="#22c55e" size={18} />
                </View>
                <View>
                  <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                    Refill Selling Area
                  </Text>
                  <Text className={`font-jetbrains text-[10px] text-[#22c55e]`}>
                    TAKE FROM: {refillModalItem?.boxNumber}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setRefillModalItem(null)}>
                <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
              </TouchableOpacity>
            </View>

            {refillModalItem && (
              <>
                <StoreItemSummaryCard
                  item={refillModalItem}
                  targetBox={refillModalItem.boxNumber}
                  isDark={isDark}
                  textPrimaryClass={textPrimaryClass}
                  textSecondaryClass={textSecondaryClass}
                  uploadedImageUrl={
                    uploadedItemImages[
                      getItemImageKey({
                        sku: refillModalItem.sku,
                        upc: refillModalItem.upc,
                        id: refillModalItem.id,
                      })
                    ]
                  }
                  isCheckingImage={
                    checkingImageKey ===
                    getItemImageKey({
                      sku: refillModalItem.sku,
                      upc: refillModalItem.upc,
                      id: refillModalItem.id,
                    })
                  }
                  onOpenSearchInBrowser={handleOpenItemSearchInBrowser}
                  onPressPreviewImage={(payload) =>
                    setImageZoomModal({
                      ...payload,
                      boxNumber: refillModalItem.boxNumber,
                      qty: refillModalItem.qty,
                    })
                  }
                  onPressUploadImage={(target) => handleRequestUploadImage(target)}
                />

                <View className="mb-3 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-2.5">
                  <Text className="font-jetbrains text-xs font-bold text-[#22c55e]">
                    📦 Box {refillModalItem.boxNumber} currently has {refillModalItem.qty} units.
                  </Text>
                </View>

                <Text className={`mb-1.5 font-jetbrains text-xs font-semibold ${textPrimaryClass}`}>
                  UNITS TO REFILL DISPLAY:
                </Text>

                <View className="mb-4 flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      const cur = parseInt(refillQtyInput, 10) || 0;
                      setRefillQtyInput(String(Math.max(1, cur - 1)));
                    }}
                    className={`h-11 w-11 items-center justify-center rounded-lg border ${
                      isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                    }`}>
                    <Minus color={isDark ? '#fafafa' : '#18181b'} size={18} />
                  </TouchableOpacity>

                  <TextInput
                    value={refillQtyInput}
                    onChangeText={setRefillQtyInput}
                    keyboardType="number-pad"
                    className={`h-11 flex-1 rounded-lg border text-center font-jetbrains text-base font-bold ${
                      isDark
                        ? 'border-[#3f3f46] bg-[#131316] text-[#fafafa]'
                        : 'border-[#d4d4d8] bg-[#fafafa] text-[#18181b]'
                    }`}
                  />

                  <TouchableOpacity
                    onPress={() => {
                      const cur = parseInt(refillQtyInput, 10) || 0;
                      setRefillQtyInput(String(Math.min(refillModalItem.qty, cur + 1)));
                    }}
                    className={`h-11 w-11 items-center justify-center rounded-lg border ${
                      isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                    }`}>
                    <Plus color={isDark ? '#fafafa' : '#18181b'} size={18} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setRefillQtyInput(String(refillModalItem.qty))}
                    className="h-11 items-center justify-center rounded-lg bg-[#22c55e]/20 px-3">
                    <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                      TAKE ALL
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setRefillModalItem(null)}
                    className={`flex-1 items-center justify-center rounded-lg border py-3 ${
                      isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                    }`}>
                    <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                      CANCEL
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmRefillItem}
                    activeOpacity={0.8}
                    className="flex-1 items-center justify-center rounded-lg bg-[#22c55e] py-3 active:bg-[#16a34a]">
                    <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                      REFILL DISPLAY
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View className={`flex-row items-center gap-3 border-b px-4 py-2.5 ${headerBgClass}`}>
        <TouchableOpacity
          onPress={() => {
            if (navigation && typeof navigation.goBack === 'function') {
              navigation.goBack();
            }
          }}
          className="h-9 w-9 items-center justify-center rounded-xl border border-[#e5005c]/30 bg-[#e5005c]/10">
          <ArrowLeft color="#e5005c" size={18} />
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center gap-2">
          <View>
            <View className="flex-row items-center gap-2">
              <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                Rebox Scanner
              </Text>
              <View className="rounded-md bg-[#e5005c] px-2 py-0.5">
                <Text className="font-jetbrains text-[11px] font-bold text-[#ffffff]">
                  {currentBoxNumber}
                </Text>
              </View>
            </View>
            <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
              {itemsInCurrentBox.length} SKUs · {currentBoxUnits} UNITS IN BOX
            </Text>
          </View>
          {lastScanned && (
            <View className="flex-row items-center gap-1 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-1">
              <CheckCircle color="#22c55e" size={12} />
              <Text
                className="max-w-[95px] font-jetbrains text-[9px] font-bold text-[#22c55e]"
                numberOfLines={1}>
                {lastScanned}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-1.5">
          <TouchableOpacity
            onPress={() => handleDownloadPdf()}
            disabled={isExportingPdf}
            className="flex-row items-center gap-1 rounded-lg border border-[#22c55e]/50 bg-[#22c55e]/15 px-2.5 py-1.5">
            {isExportingPdf ? (
              <ActivityIndicator size={12} color="#22c55e" />
            ) : (
              <Download color="#22c55e" size={13} />
            )}
            <Text className="font-jetbrains text-xs font-bold text-[#22c55e]">
              {isExportingPdf ? 'PDF...' : 'PDF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={reloadData}
            className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
              isDark ? 'border-[#3f3f46] bg-[#2a2a2d]/80' : 'border-[#d4d4d8] bg-[#f4f4f5]'
            }`}>
            <RefreshCw color={isDark ? '#fafafa' : '#18181b'} size={13} />
            <Text className={`font-jetbrains text-xs font-semibold ${textPrimaryClass}`}>SYNC</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Physical Box Location Indicator Bar */}
      <View className={`flex-row items-center justify-between border-b px-4 py-2.5 ${cardBgClass}`}>
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e5005c]/15">
            <BoxIcon color="#e5005c" size={17} />
          </View>
          <View className="flex-1">
            <Text
              className={`font-jetbrains text-[9px] font-bold tracking-wider ${textSecondaryClass}`}>
              PACKING INTO STOCKROOM BOX
            </Text>
            <Text className="font-jetbrains text-sm font-bold text-[#e5005c]" numberOfLines={1}>
              {currentBoxNumber} · {itemsInCurrentBox.length} SKUs ({currentBoxUnits} Units)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            setCustomBoxInput('');
            setShowBoxSelectorModal(true);
          }}
          className={`flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
            isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
          }`}>
          <Edit3 color="#e5005c" size={12} />
          <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>SWITCH BOX</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Notification Toast */}
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

      {/* Camera Barcode Scanner Area (Hold to Scan) */}
      {!isFullScreenTabs && (
        <View className="relative h-[32%] overflow-hidden bg-black">
          {!permission ? (
            <View className="flex-1 items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#e5005c" />
              <Text className={`font-hanken text-sm ${textSecondaryClass}`}>Loading camera...</Text>
            </View>
          ) : !permission.granted ? (
            <View className="flex-1 items-center justify-center gap-3 px-6">
              <AlertTriangle color="#eab308" size={36} />
              <Text className={`text-center font-hanken text-sm ${textSecondaryClass}`}>
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
          ) : uploadImageModalItem || storeModalItem || refillModalItem || imageZoomModal ? (
            <View className="flex-1 items-center justify-center bg-black">
              <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
                Scanner paused for active dialog...
              </Text>
            </View>
          ) : (
            <CameraView
              ref={scannerCameraRef}
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

          {permission?.granted && (
            <>
              {/* Corner reticle brackets */}
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

              {/* Laser animation */}
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
                          outputRange: [35, 170],
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
                  className={`flex-row items-center gap-1.5 rounded-xl border px-3.5 py-3 ${
                    isDark ? 'border-[#3f3f46] bg-[#2a2a2d]/90' : 'border-[#d4d4d8] bg-white'
                  }`}>
                  <Keyboard color={isDark ? '#a1a1aa' : '#71717a'} size={16} />
                  <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                    MANUAL
                  </Text>
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
            <ChevronDown color="#e5005c" size={14} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
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

      {/* Bluetooth Scanner Input Bar (When Swiped Up) */}
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
                    ? 'bg-[#e5005c]/15'
                    : isDark
                      ? 'bg-[#2a2a2d]'
                      : 'bg-[#f4f4f5]'
                }`}>
                <Bluetooth
                  color={isBluetoothScannerActive ? '#e5005c' : isDark ? '#a1a1aa' : '#71717a'}
                  size={14}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`font-jetbrains text-[11px] font-bold ${
                    isBluetoothScannerActive ? 'text-[#e5005c]' : textPrimaryClass
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
                    ? 'border-[#e5005c] bg-[#e5005c]'
                    : isDark
                      ? 'border-[#3f3f46] bg-[#2a2a2d]'
                      : 'border-[#d4d4d8] bg-[#f4f4f5]'
                }`}>
                <Text
                  className={`font-jetbrains text-[10px] font-bold ${
                    isBluetoothScannerActive ? 'text-[#ffffff]' : textSecondaryClass
                  }`}>
                  {isBluetoothScannerActive ? 'ACTIVE' : 'OFF'}
                </Text>
                <View
                  className={`h-4 w-7 justify-center rounded-full px-0.5 ${
                    isBluetoothScannerActive
                      ? 'items-end bg-white/30'
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
                        ? 'border-[#e5005c]/40 bg-[#131316]'
                        : 'border-[#e5005c]/50 bg-[#fafafa]'
                  }`}>
                  <Scan color={isBuffering ? '#eab308' : '#e5005c'} size={16} />
                  <TextInput
                    ref={bluetoothInputRef}
                    value={bluetoothInput}
                    onChangeText={handleBluetoothTextChange}
                    placeholder="Scan or type SKU or UPC..."
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
                  className="h-11 items-center justify-center rounded-xl bg-[#e5005c] px-4">
                  <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">SCAN</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3 Tabs: CURRENT BOX / REFILL SEARCH / ALL BOXES */}
      <View className={`border-b ${tabBgClass}`}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          <TouchableOpacity
            onPress={() => setActiveTab('current_box')}
            className={`flex-row items-center gap-1.5 px-4 py-3.5 ${
              activeTab === 'current_box'
                ? `border-b-2 border-[#e5005c] ${isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]'}`
                : ''
            }`}>
            <Boxes color={activeTab === 'current_box' ? '#e5005c' : '#71717a'} size={14} />
            <Text
              className={`font-jetbrains text-xs font-bold ${
                activeTab === 'current_box' ? 'text-[#e5005c]' : textSecondaryClass
              }`}>
              {currentBoxNumber} ({itemsInCurrentBox.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('refill_search')}
            className={`flex-row items-center gap-1.5 px-4 py-3.5 ${
              activeTab === 'refill_search'
                ? `border-b-2 border-[#22c55e] ${isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]'}`
                : ''
            }`}>
            <Search color={activeTab === 'refill_search' ? '#22c55e' : '#71717a'} size={14} />
            <Text
              className={`font-jetbrains text-xs font-bold ${
                activeTab === 'refill_search' ? 'text-[#22c55e]' : textSecondaryClass
              }`}>
              REFILL SEARCH ({allReboxItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('all_boxes')}
            className={`flex-row items-center gap-1.5 px-4 py-3.5 ${
              activeTab === 'all_boxes'
                ? `border-b-2 border-[#f59e0b] ${isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]'}`
                : ''
            }`}>
            <Layers color={activeTab === 'all_boxes' ? '#f59e0b' : '#71717a'} size={14} />
            <Text
              className={`font-jetbrains text-xs font-bold ${
                activeTab === 'all_boxes' ? 'text-[#f59e0b]' : textSecondaryClass
              }`}>
              STOCKROOM BOXES ({boxSummaries.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search Filter Bar */}
      {activeTab !== 'all_boxes' && (
        <View className={`border-b px-4 py-2.5 ${cardBgClass}`}>
          <View className="flex-row items-center justify-between gap-2">
            <View
              className={`flex-1 flex-row items-center gap-2 rounded-lg border px-3 py-1.5 ${innerCardBgClass}`}>
              <Search color={isDark ? '#71717a' : '#a1a1aa'} size={15} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={
                  activeTab === 'refill_search'
                    ? 'Search SKU, UPC, or Box Number to refill...'
                    : `Search in ${currentBoxNumber}...`
                }
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                className={`flex-1 p-0 font-jetbrains text-xs ${textPrimaryClass}`}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X color={isDark ? '#a1a1aa' : '#71717a'} size={14} />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setShowSortModal(true)}
              className={`flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
                sortBy !== 'default'
                  ? 'border-[#e5005c] bg-[#e5005c]/15'
                  : isDark
                    ? 'border-[#3f3f46] bg-[#2a2a2d]'
                    : 'border-[#d4d4d8] bg-[#f4f4f5]'
              }`}>
              <ArrowUpDown
                color={sortBy !== 'default' ? '#e5005c' : isDark ? '#a1a1aa' : '#71717a'}
                size={14}
              />
              <Text
                className={`font-jetbrains text-xs font-bold ${
                  sortBy !== 'default' ? 'text-[#e5005c]' : textPrimaryClass
                }`}>
                {sortBy === 'qty_desc'
                  ? 'QTY 🠗'
                  : sortBy === 'qty_asc'
                    ? 'QTY 🠕'
                    : sortBy === 'alpha_asc'
                      ? 'A-Z'
                      : sortBy === 'alpha_desc'
                        ? 'Z-A'
                        : 'SORT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content Area */}
      {isLoadingItems ? (
        <View className={`flex-1 items-center justify-center gap-3 py-16 ${bgClass}`}>
          <ActivityIndicator size="small" color="#e5005c" />
          <Text className={`font-jetbrains text-xs font-semibold ${textSecondaryClass}`}>
            Syncing rebox items with Supabase...
          </Text>
        </View>
      ) : activeTab === 'all_boxes' ? (
        <FlatList
          data={boxSummaries}
          keyExtractor={(item) => item.boxNumber}
          className={`flex-1 px-4 py-4 ${bgClass}`}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Boxes color={isDark ? '#71717a' : '#a1a1aa'} size={32} className="mb-2" />
              <Text className={`font-hanken text-sm ${textSecondaryClass}`}>
                No storage boxes created in the stockroom yet.
              </Text>
              <Text className={`mt-1 font-jetbrains text-xs ${textSecondaryClass}`}>
                Scan or enter an item above to create your first box!
              </Text>
            </View>
          }
          renderItem={({ item: box }) => {
            const isCurrent = box.boxNumber === currentBoxNumber;
            return (
              <TouchableOpacity
                onPress={() => {
                  changeCurrentBox(box.boxNumber);
                  setActiveTab('current_box');
                }}
                activeOpacity={0.7}
                className={`mb-3 rounded-xl border p-4 shadow-sm ${
                  isCurrent
                    ? 'border-[#e5005c] bg-[#e5005c]/10'
                    : isDark
                      ? 'border-[#3f3f46] bg-[#1f1f22]'
                      : 'border-[#e4e4e7] bg-[#ffffff]'
                }`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5">
                    <View className="rounded-lg bg-[#e5005c]/15 p-2">
                      <BoxIcon color="#e5005c" size={20} />
                    </View>
                    <View>
                      <Text className={`font-jetbrains text-sm font-bold ${textPrimaryClass}`}>
                        {box.boxNumber}
                      </Text>
                      <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                        {box.itemCount} unique SKUs stored
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    {box.itemCount > 0 && (
                      <TouchableOpacity
                        onPress={() => handleDownloadPdf(box.boxNumber)}
                        disabled={isExportingPdf}
                        className="flex-row items-center gap-1 rounded-lg border border-[#22c55e]/45 bg-[#22c55e]/15 px-2.5 py-1.5">
                        <Download color="#22c55e" size={12} />
                        <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                          PDF
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View className="items-end">
                      <View className="rounded bg-[#22c55e]/20 px-2.5 py-0.5">
                        <Text className="font-jetbrains text-xs font-bold text-[#22c55e]">
                          {box.totalUnits} UNITS
                        </Text>
                      </View>
                      <Text className={`mt-1 font-jetbrains text-[9px] text-[#e5005c]`}>
                        TAP TO VIEW BOX ➔
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          className={`flex-1 px-4 py-4 ${bgClass}`}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Package color={isDark ? '#71717a' : '#a1a1aa'} size={32} className="mb-2" />
              <Text className={`font-hanken text-sm ${textSecondaryClass}`}>
                {activeTab === 'current_box'
                  ? `No items stored in ${currentBoxNumber} yet.`
                  : 'No matching items found across stockroom boxes.'}
              </Text>
              <Text className={`mt-1 font-jetbrains text-xs ${textSecondaryClass}`}>
                {activeTab === 'current_box'
                  ? 'Hold scanner above or tap MANUAL to add items.'
                  : 'Search by SKU, UPC barcode, or Box Number.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cardImageKey = getItemImageKey({
              sku: item.sku,
              upc: item.upc,
              id: item.id,
            });
            return (
              <ReboxItemCard
                key={item.id}
                item={item}
                isDark={isDark}
                textPrimaryClass={textPrimaryClass}
                textSecondaryClass={textSecondaryClass}
                uploadedImageUrl={uploadedItemImages[cardImageKey]}
                isCheckingImage={checkingImageKey === cardImageKey}
                mode={activeTab === 'refill_search' ? 'refill_search' : 'current_box'}
                onOpenSearchInBrowser={handleOpenItemSearchInBrowser}
                onPressPreviewImage={(payload) =>
                  setImageZoomModal({
                    ...payload,
                    boxNumber: item.boxNumber,
                    qty: item.qty,
                  })
                }
                onPressUploadImage={(target) => handleRequestUploadImage(target)}
                onRefill={(target) => {
                  setRefillModalItem(target);
                  setRefillQtyInput('1');
                }}
                onQtyAdjust={(target, delta) => handleInlineQtyAdjust(target, delta)}
                onHoldDelete={(target) => handleHoldDeleteItem(target)}
              />
            );
          }}
        />
      )}

      {/* Progress Footer */}
      <View
        className={`border-t px-4 ${footerBgClass}`}
        style={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text
              className={`font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
              STOCKROOM INVENTORY
            </Text>
            <Text className="font-jetbrains text-sm font-bold text-[#e5005c]">
              {boxSummaries.length} Boxes · {totalStockroomUnits} Total Units
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setCustomBoxInput('');
              setShowBoxSelectorModal(true);
            }}
            className="flex-row items-center gap-1.5 rounded-lg bg-[#e5005c] px-3.5 py-2 active:bg-[#c20050]">
            <BoxIcon color="#ffffff" size={14} />
            <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
              {currentBoxNumber}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* In-Window Camera Capture & Cloudinary Upload Overlay */}
      {uploadImageModalItem && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 50 }]}>
          <ItemImageCaptureModalContent
            item={uploadImageModalItem}
            isDark={isDark}
            permission={permission}
            onRequestPermission={requestPermission}
            onClose={() => setUploadImageModalItem(null)}
            onUploaded={(result) => {
              const cleanUpc = (uploadImageModalItem.upc || '').trim();
              const cleanSku = (uploadImageModalItem.sku || '').trim();
              const itemKey = getItemImageKey({
                sku: cleanSku,
                upc: cleanUpc,
                id: uploadImageModalItem.id,
              });
              if (cleanUpc) {
                failedItemImagesCache.delete(cleanUpc);
              }
              setUploadedItemImages((prev) => {
                const next = { ...prev, [itemKey]: result.secureUrl };
                if (cleanUpc) next[`upc:${cleanUpc}`] = result.secureUrl;
                if (cleanSku) next[`sku:${cleanSku}`] = result.secureUrl;
                AsyncStorage.setItem(UPLOADED_ITEM_IMAGES_KEY, JSON.stringify(next)).catch(
                  () => {}
                );
                return next;
              });
              setStoreModalItem((prev) =>
                prev &&
                ((cleanUpc && prev.upc === cleanUpc) || (cleanSku && prev.sku === cleanSku))
                  ? { ...prev, imageUrl: result.secureUrl }
                  : prev
              );
              setUploadImageModalItem(null);
              showNotification(
                'success',
                result.alreadyExisted ? '✓ IMAGE ALREADY AVAILABLE' : '✓ IMAGE UPLOADED',
                result.alreadyExisted
                  ? `Loaded existing image for UPC ${result.publicId}`
                  : `Uploaded as ${result.publicId} (${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET})`
              );
              playScanFeedback('success');
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
