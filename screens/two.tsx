import React, { useState, useCallback, useEffect, useMemo, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Image,
  StatusBar,
  Alert,
  Linking,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Boxes,
  Box as BoxIcon,
  Scan,
  Search,
  Plus,
  Minus,
  Package,
  RefreshCw,
  Store,
  CheckCircle,
  AlertTriangle,
  X,
  ArrowRight,
  Layers,
  Trash2,
  Edit3,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Camera,
  CloudUpload,
  Flashlight,
  Download,
} from 'lucide-react-native';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/theme';
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
  type ProductItem,
  fetchReboxItems,
  fetchReboxBoxes,
  getActiveReboxBox,
  setActiveReboxBox,
  registerReboxBox,
  suggestNextBoxNumber,
  normalizeBoxNumber,
  renameReboxBox,
  deleteEntireReboxBox,
  refillItemFromBox,
  updateReboxItemQty,
  deleteReboxItem,
  REBOX_HOLD_PRESS_IN_DELAY_MS,
  REBOX_HOLD_LONG_PRESS_DELAY_MS,
  isUploadedPhoto,
  fetchOpenSheetCatalog,
  checkExistingProductImage,
  uploadReboxImageToCloudinary,
  ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET,
  downloadReboxPdf,
} from '../utils/rebox';

export { SCAN_HISTORY_KEY, type HistorySessionRecord, saveSessionToHistory };

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

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Just now';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (isNaN(diffMs) || diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const failedHubItemImagesCache = new Set<string>();

interface HubImagePreviewPayload {
  item: { upc?: string; sku?: string; description?: string; id?: string };
  thumbnailUrl: string;
  highResUrl: string;
  boxNumber?: string;
  qty?: number;
}

function HubItemThumbnail({
  item,
  uploadedImageUrl,
  isDark,
  size = 44,
}: {
  item: { upc?: string };
  uploadedImageUrl?: string;
  isDark: boolean;
  size?: number;
}) {
  const cleanUpc = (item.upc || '').trim();
  const [fallbackTier, setFallbackTier] = useState<'daiso' | 'cloudinary_products' | 'cloudinary_root'>(
    'daiso'
  );
  const [failedUpc, setFailedUpc] = useState<string | null>(() =>
    cleanUpc && failedHubItemImagesCache.has(cleanUpc) ? cleanUpc : null
  );
  const [failedUploadedUri, setFailedUploadedUri] = useState<string | null>(null);

  const candidateUpload = isUploadedPhoto(uploadedImageUrl) ? uploadedImageUrl : undefined;
  const activeUploadedUrl =
    candidateUpload && failedUploadedUri !== candidateUpload ? candidateUpload : undefined;

  const isImageMissing =
    !activeUploadedUrl &&
    (!cleanUpc || failedUpc === cleanUpc || failedHubItemImagesCache.has(cleanUpc));

  const imageUrl = activeUploadedUrl
    ? activeUploadedUrl
    : fallbackTier === 'cloudinary_products'
      ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/products/${cleanUpc}`
      : fallbackTier === 'cloudinary_root'
        ? `https://res.cloudinary.com/dqtldfxeh/image/upload/c_fill,w_200,h_200/${cleanUpc}`
        : `https://jpbulk.daisonet.com/cdn/shop/files/${cleanUpc}_10_400x.jpg`;

  const handleImageError = () => {
    if (activeUploadedUrl) {
      setFailedUploadedUri(activeUploadedUrl);
    } else if (fallbackTier === 'daiso') {
      setFallbackTier('cloudinary_products');
    } else if (fallbackTier === 'cloudinary_products') {
      setFallbackTier('cloudinary_root');
    } else {
      if (cleanUpc) {
        failedHubItemImagesCache.add(cleanUpc);
      }
      setFailedUpc(cleanUpc);
    }
  };

  if (isImageMissing) {
    return (
      <View
        style={{ width: size, height: size }}
        className={`items-center justify-center rounded-lg border ${
          isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
        }`}>
        <Package color={isDark ? '#52525b' : '#a1a1aa'} size={Math.round(size * 0.42)} />
      </View>
    );
  }

  return (
    <View
      style={{ width: size, height: size }}
      className={`overflow-hidden rounded-lg border ${
        isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#ffffff]'
      }`}>
      <Image
        source={{ uri: imageUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        onError={handleImageError}
      />
    </View>
  );
}

function HubBoxPreviewItemRow({
  item,
  index,
  uploadedImageUrl,
  isDark,
  textPrimaryClass,
  textSecondaryClass,
  onPressBox,
  onHoldDelete,
}: {
  item: ReboxItem;
  index: number;
  uploadedImageUrl?: string;
  isDark: boolean;
  textPrimaryClass: string;
  textSecondaryClass: string;
  onPressBox: () => void;
  onHoldDelete: (item: ReboxItem) => Promise<void> | void;
}) {
  const [isHoldingDelete, setIsHoldingDelete] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [holdProgressAnim] = useState(() => new Animated.Value(0));
  const didLongPressRef = useRef(false);
  const pressStartTimeRef = useRef(0);

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

  const handlePress = () => {
    const heldDuration =
      pressStartTimeRef.current > 0 ? Date.now() - pressStartTimeRef.current : 0;
    pressStartTimeRef.current = 0;
    if (didLongPressRef.current || isDeletingItem || heldDuration > 350) {
      didLongPressRef.current = false;
      return;
    }
    onPressBox();
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
      onPress={handlePress}
      className={`relative flex-row items-center gap-2.5 overflow-hidden rounded-lg px-1 py-1 ${
        isDeletingItem ? 'opacity-60 ' : ''
      }${isHoldingDelete ? 'bg-[#ef4444]/10 ' : ''}${
        index > 0
          ? `mt-1.5 border-t pt-2 ${isDark ? 'border-[#2f2f35]' : 'border-[#e4e4e7]'}`
          : ''
      }`}>
      <HubItemThumbnail
        item={item}
        uploadedImageUrl={uploadedImageUrl}
        isDark={isDark}
        size={34}
      />
      <View className="flex-1">
        <Text
          className={`font-hanken text-xs font-semibold ${textPrimaryClass}`}
          numberOfLines={1}>
          {item.description || item.sku || item.upc}
        </Text>
        <Text className={`font-jetbrains text-[9px] ${textSecondaryClass}`}>
          {isDeletingItem
            ? 'DELETING ITEM...'
            : isHoldingDelete
              ? 'HOLD 3S TO DELETE...'
              : `SKU: ${item.sku || 'N/A'}${item.upc ? ` · UPC: ${item.upc}` : ''}`}
        </Text>
      </View>
      {isHoldingDelete || isDeletingItem ? (
        <View className="flex-row items-center gap-1 rounded bg-[#ef4444] px-1.5 py-0.5">
          {isDeletingItem ? (
            <ActivityIndicator size={9} color="#ffffff" />
          ) : (
            <Trash2 color="#ffffff" size={9} />
          )}
          <Text className="font-jetbrains text-[9px] font-bold text-[#ffffff]">
            {isDeletingItem ? '...' : '3S'}
          </Text>
        </View>
      ) : (
        <View className="rounded bg-[#e5005c]/15 px-2 py-0.5">
          <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
            x{item.qty}
          </Text>
        </View>
      )}
      {isHoldingDelete && (
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ef4444]/20">
          <Animated.View style={{ width: holdBarWidth }} className="h-full bg-[#ef4444]" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function HubReboxItemCard({
  item,
  isDark,
  textPrimaryClass,
  textSecondaryClass,
  uploadedImageUrl,
  isCheckingImage,
  showOpenBoxButton,
  onOpenBoxScanner,
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
  showOpenBoxButton?: boolean;
  onOpenBoxScanner?: (boxNumber: string) => void;
  onOpenSearchInBrowser: (item: { upc?: string; sku?: string; description?: string }) => void;
  onPressPreviewImage: (payload: HubImagePreviewPayload) => void;
  onPressUploadImage: (item: ReboxItem) => void;
  onRefill: (item: ReboxItem) => void;
  onQtyAdjust?: (item: ReboxItem, delta: number) => void;
  onHoldDelete: (item: ReboxItem) => Promise<void> | void;
}) {
  const cleanUpc = (item.upc || '').trim();
  const [fallbackTier, setFallbackTier] = useState<'daiso' | 'cloudinary_products' | 'cloudinary_root'>(
    'daiso'
  );
  const [failedUpc, setFailedUpc] = useState<string | null>(() =>
    cleanUpc && failedHubItemImagesCache.has(cleanUpc) ? cleanUpc : null
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
    (!cleanUpc || failedUpc === cleanUpc || failedHubItemImagesCache.has(cleanUpc));
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
        failedHubItemImagesCache.add(cleanUpc);
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
          : isDark
            ? 'border-[#3f3f46] bg-[#1f1f22]'
            : 'border-[#e4e4e7] bg-[#ffffff]'
      }`}>
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

      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-1">
          <Text
            className={`flex-1 font-hanken text-xs font-bold leading-4 ${textPrimaryClass}`}
            numberOfLines={2}>
            {item.description || 'Unnamed Item'}
          </Text>
          {!isImageAvailable && (
            <TouchableOpacity
              onPress={() => onOpenSearchInBrowser(item)}
              className={`flex-row items-center gap-1 rounded border px-1.5 py-0.5 ${
                isDark
                  ? 'border-[#ff80ab]/40 bg-[#ff80ab]/10'
                  : 'border-[#e5005c]/30 bg-[#e5005c]/10'
              }`}>
              <ExternalLink color={isDark ? '#ff80ab' : '#e5005c'} size={10} />
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
          <TouchableOpacity
            disabled={!showOpenBoxButton || !onOpenBoxScanner}
            onPress={() => onOpenBoxScanner?.(item.boxNumber)}
            className="flex-row items-center gap-1 rounded bg-[#e5005c] px-2 py-0.5">
            <BoxIcon color="#ffffff" size={10} />
            <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
              BOX: {item.boxNumber}
            </Text>
          </TouchableOpacity>

          {item.sku ? (
            <View className="rounded border border-[#e5005c]/30 bg-[#e5005c]/10 px-1.5 py-0.5">
              <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                SKU: {item.sku}
              </Text>
            </View>
          ) : null}
        </View>

        {item.upc ? (
          <View className="mt-1 flex-row items-center">
            <View
              className={`rounded border px-1.5 py-0.5 ${
                isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
              }`}>
              <Text className={`font-jetbrains text-[9px] ${textSecondaryClass}`}>
                UPC: {item.upc}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {onQtyAdjust ? (
        <View className="items-end gap-1.5">
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              onPress={() => onQtyAdjust(item, -1)}
              className={`h-7 w-7 items-center justify-center rounded-md border ${
                isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
              }`}>
              <Minus color={isDark ? '#fafafa' : '#18181b'} size={12} />
            </TouchableOpacity>
            <View className="min-w-[30px] items-center rounded-md border border-[#e5005c]/40 bg-[#e5005c]/10 px-1.5 py-1">
              <Text className="font-jetbrains text-xs font-bold text-[#e5005c]">{item.qty}</Text>
            </View>
            <TouchableOpacity
              onPress={() => onQtyAdjust(item, 1)}
              className={`h-7 w-7 items-center justify-center rounded-md border ${
                isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
              }`}>
              <Plus color={isDark ? '#fafafa' : '#18181b'} size={12} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => onRefill(item)}
            className="rounded border border-[#22c55e]/40 bg-[#22c55e]/15 px-2 py-0.5">
            <Text className="font-jetbrains text-[9px] font-bold text-[#22c55e]">REFILL</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="items-end justify-center gap-1.5">
          <View className="rounded-md border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-0.5">
            <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
              {item.qty} UNITS
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onRefill(item)}
            activeOpacity={0.8}
            className="rounded-lg bg-[#22c55e] px-2.5 py-1.5">
            <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">REFILL</Text>
          </TouchableOpacity>
        </View>
      )}

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

function HubImageZoomModalContent({
  payload,
  isDark,
  textPrimaryClass,
  textSecondaryClass,
  onClose,
}: {
  payload: HubImagePreviewPayload;
  isDark: boolean;
  textPrimaryClass: string;
  textSecondaryClass: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeUri, setActiveUri] = useState(payload.highResUrl || payload.thumbnailUrl);

  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const gestureStartRef = useRef({
    pinchDist: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
    moved: false,
  });

  const applyScale = useCallback((next: number, nextOffset?: { x: number; y: number }) => {
    const clamped = Math.min(4, Math.max(1, Math.round(next * 100) / 100));
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped <= 1.02) {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    } else if (nextOffset) {
      const maxPan = 120 * (clamped - 1);
      const clampedOffset = {
        x: Math.max(-maxPan, Math.min(maxPan, nextOffset.x)),
        y: Math.max(-maxPan, Math.min(maxPan, nextOffset.y)),
      };
      offsetRef.current = clampedOffset;
      setOffset(clampedOffset);
    }
  }, []);

  const handleResponderGrant = useCallback((evt: any) => {
    const touches = evt.nativeEvent.touches || [];
    gestureStartRef.current.moved = false;
    gestureStartRef.current.startX = evt.nativeEvent.pageX || 0;
    gestureStartRef.current.startY = evt.nativeEvent.pageY || 0;
    gestureStartRef.current.panX = offsetRef.current.x;
    gestureStartRef.current.panY = offsetRef.current.y;
    gestureStartRef.current.startScale = scaleRef.current;

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
          gestureStartRef.current.startScale = scaleRef.current;
        } else if (dist > 0) {
          applyScale(gestureStartRef.current.startScale * (dist / gestureStartRef.current.pinchDist));
        }
      } else if (scaleRef.current > 1.02) {
        const dx = (evt.nativeEvent.pageX || 0) - gestureStartRef.current.startX;
        const dy = (evt.nativeEvent.pageY || 0) - gestureStartRef.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          gestureStartRef.current.moved = true;
        }
        applyScale(scaleRef.current, {
          x: gestureStartRef.current.panX + dx,
          y: gestureStartRef.current.panY + dy,
        });
      }
    },
    [applyScale]
  );

  const handleResponderRelease = useCallback(() => {
    if (!gestureStartRef.current.moved) {
      const now = Date.now();
      if (lastTapRef.current > 0 && now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        applyScale(scaleRef.current > 1.2 ? 1 : 2.2, { x: 0, y: 0 });
      } else {
        lastTapRef.current = now;
      }
    }
  }, [applyScale]);

  return (
    <View className="flex-1 items-center justify-center bg-black/85 px-4">
      <View
        className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
        }`}>
        <View
          className={`flex-row items-center justify-between border-b px-4 py-3 ${
            isDark ? 'border-[#3f3f46]' : 'border-[#e4e4e7]'
          }`}>
          <View className="flex-row items-center gap-2.5">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e5005c]/15">
              <ZoomIn color="#e5005c" size={16} />
            </View>
            <View>
              <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                Item Image Preview
              </Text>
              <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                SKU: {payload.item.sku || 'N/A'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className={`h-8 w-8 items-center justify-center rounded-lg border ${
              isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            <X color={isDark ? '#fafafa' : '#18181b'} size={16} />
          </TouchableOpacity>
        </View>

        <View className="relative h-72 w-full items-center justify-center overflow-hidden bg-white">
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={(evt) =>
              (evt.nativeEvent.touches?.length || 0) >= 2 || scaleRef.current > 1.02
            }
            onResponderGrant={handleResponderGrant}
            onResponderMove={handleResponderMove}
            onResponderRelease={handleResponderRelease}
            className="h-full w-full items-center justify-center">
            <Image
              source={{ uri: activeUri }}
              style={{
                width: '100%',
                height: '100%',
                transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }],
              }}
              resizeMode="contain"
              onError={() => {
                if (activeUri !== payload.thumbnailUrl) {
                  setActiveUri(payload.thumbnailUrl);
                }
              }}
            />
          </View>
          <View className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/65 px-2.5 py-1">
            <Text className="font-jetbrains text-[10px] text-white">
              Pinch or double-tap to zoom
            </Text>
          </View>
          <View className="absolute bottom-2.5 right-2.5 flex-row items-center gap-1.5 rounded-xl bg-black/75 px-2 py-1">
            <TouchableOpacity onPress={() => applyScale(scaleRef.current - 0.5)} className="p-1">
              <ZoomOut color="#ffffff" size={14} />
            </TouchableOpacity>
            <View className="rounded bg-white/15 px-1.5 py-0.5">
              <Text className="font-jetbrains text-[10px] font-bold text-white">
                {scale.toFixed(1)}x
              </Text>
            </View>
            <TouchableOpacity onPress={() => applyScale(scaleRef.current + 0.5)} className="p-1">
              <ZoomIn color="#ffffff" size={14} />
            </TouchableOpacity>
            {scale > 1.05 && (
              <TouchableOpacity onPress={() => applyScale(1)} className="p-1">
                <RotateCcw color="#ff80ab" size={13} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="p-4">
          <View className="mb-2 flex-row flex-wrap items-center gap-2">
            {payload.boxNumber ? (
              <View className="rounded border border-[#e5005c]/40 bg-[#e5005c]/10 px-2 py-0.5">
                <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                  BOX: {payload.boxNumber}
                </Text>
              </View>
            ) : null}
            {typeof payload.qty === 'number' ? (
              <View className="rounded border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-0.5">
                <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                  AVAILABLE: {payload.qty} UNITS
                </Text>
              </View>
            ) : null}
          </View>
          <Text className={`mb-3 font-hanken text-sm font-bold ${textPrimaryClass}`}>
            {payload.item.description || 'Unnamed Item'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className={`items-center justify-center rounded-xl border py-2.5 ${
              isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

async function cropHubImageToSquare(
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
      if (imgWidth > 0 && imgHeight > 0 && imgWidth !== imgHeight) {
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
      if (fallbackWidth !== fallbackHeight) {
        const size = Math.min(fallbackWidth, fallbackHeight);
        const originX = Math.floor((fallbackWidth - size) / 2);
        const originY = Math.floor((fallbackHeight - size) / 2);
        const cropped = await mod.manipulateAsync(
          uri,
          [{ crop: { originX, originY, width: size, height: size } }],
          { compress: 0.9, format: mod.SaveFormat?.JPEG || 'jpeg' }
        );
        return cropped.uri;
      }
    }
  } catch {}
  return uri;
}

function HubImageCaptureModalContent({
  item,
  isDark,
  permission,
  onRequestPermission,
  onClose,
  onUploaded,
}: {
  item: ReboxItem;
  isDark: boolean;
  permission: ReturnType<typeof useCameraPermissions>[0];
  onRequestPermission: () => void;
  onClose: () => void;
  onUploaded: (result: { secureUrl: string; alreadyExisted: boolean; publicId: string }) => void;
}) {
  const cameraRef = useRef<CameraView | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  const isCaptureDisabled =
    !permission?.granted || isCapturing || (!isCameraReady && Platform.OS !== 'web');

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        const squareUri = await cropHubImageToSquare(photo.uri, photo.width, photo.height);
        setCapturedUri(squareUri);
      } else {
        throw new Error('Camera did not return an image.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to capture photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUpload = async () => {
    if (!capturedUri || isUploading) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const result = await uploadReboxImageToCloudinary(
        capturedUri,
        item.upc,
        item.sku,
        setUploadStatusText
      );
      onUploaded(result);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Upload failed. Check connection.');
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-black/85 px-4 py-6">
      <View
        className={`max-h-[92%] w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${
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
                Upload Item Image
              </Text>
              <Text
                className={`font-jetbrains text-[10px] ${textSecondaryClass}`}
                numberOfLines={1}>
                UPC: {item.upc || item.sku || 'N/A'} · PRESET: {ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
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
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#e5005c" />
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
              <Image source={{ uri: capturedUri }} resizeMode="cover" className="h-full w-full" />
              {isUploading && (
                <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center gap-2 bg-black/75 px-6">
                  <ActivityIndicator size="large" color="#e5005c" />
                  <Text className="text-center font-jetbrains text-xs font-bold text-[#ffffff]">
                    {uploadStatusText ||
                      `Uploading ${item.upc || item.sku} (${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET})...`}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                mode="picture"
                enableTorch={torchEnabled}
                onCameraReady={() => setIsCameraReady(true)}
              />
              <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between">
                <View className="rounded-md bg-black/65 px-2.5 py-1">
                  <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
                    1:1 · CENTER PRODUCT IN FRAME
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setTorchEnabled((p) => !p)}
                  className={`flex-row items-center gap-1 rounded-lg border px-2.5 py-1.5 ${
                    torchEnabled ? 'border-[#f59e0b] bg-[#f59e0b]/25' : 'border-white/25 bg-black/65'
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
                onPress={onClose}
                className={`flex-1 items-center justify-center rounded-lg border py-3 ${
                  isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                }`}>
                <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCapture}
                disabled={isCaptureDisabled}
                className={`flex-[1.6] flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                  isCaptureDisabled ? 'bg-[#e5005c]/45' : 'bg-[#e5005c]'
                }`}>
                <Camera color="#ffffff" size={16} />
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
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-3 ${
                  isDark ? 'border-[#3f3f46] bg-[#2a2a2d]' : 'border-[#d4d4d8] bg-[#f4f4f5]'
                }`}>
                <RotateCcw color={isDark ? '#a1a1aa' : '#71717a'} size={14} />
                <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                  RETAKE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpload}
                disabled={isUploading}
                className={`flex-[1.6] flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                  isUploading ? 'bg-[#e5005c]/55' : 'bg-[#e5005c]'
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

export default function ReboxHubScreen({ navigation: propNavigation }: { navigation?: any } = {}) {
  const contextNavigation = useContext(NavigationContext);
  const navigation = propNavigation || contextNavigation;
  const { storeCode, storeName } = useAuth();
  const { isDark } = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1b1b1e] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerCardBgClass = isDark
    ? 'bg-[#1f1f22] border-[#3f3f46]'
    : 'bg-[#fafafa] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  // Hub View Mode: Choose/Browse Boxes vs Search Items for Refill
  const [hubMode, setHubMode] = useState<'boxes' | 'refill'>('boxes');
  const [boxFilterQuery, setBoxFilterQuery] = useState('');
  const [refillSearchQuery, setRefillSearchQuery] = useState('');

  // Box Creation / Selection State
  const [newBoxInput, setNewBoxInput] = useState('');
  const [activeBoxNumber, setActiveBoxNumber] = useState<string | null>(null);

  // Stockroom & Catalog State
  const [allReboxItems, setAllReboxItems] = useState<ReboxItem[]>([]);
  const [boxSummaries, setBoxSummaries] = useState<ReboxBoxSummary[]>([]);
  const [manifestItems, setManifestItems] = useState<ItemManifestRecord[]>([]);
  const [openSheetCatalog, setOpenSheetCatalog] = useState<ProductItem[]>([]);
  const [uploadedItemImages, setUploadedItemImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [exportingPdfKey, setExportingPdfKey] = useState<string | null>(null);

  // Modals State
  const [inspectingBoxNumber, setInspectingBoxNumber] = useState<string | null>(null);
  const [renamingBoxTarget, setRenamingBoxTarget] = useState<string | null>(null);
  const [renameBoxInput, setRenameBoxInput] = useState('');
  const [refillModalItem, setRefillModalItem] = useState<ReboxItem | null>(null);
  const [refillQtyInput, setRefillQtyInput] = useState('1');
  const [imageZoomModal, setImageZoomModal] = useState<HubImagePreviewPayload | null>(null);
  const [uploadImageModalItem, setUploadImageModalItem] = useState<ReboxItem | null>(null);
  const [checkingImageKey, setCheckingImageKey] = useState<string | null>(null);

  // Toast Banner
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Preload OpenSheet 150k catalog in background
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

  const storeFilter = useMemo(
    () => (storeCode || storeName ? { storeCode, storeName } : undefined),
    [storeCode, storeName]
  );

  const reloadHubData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, savedActiveBox, storedManifest, storedImages] = await Promise.all([
        fetchReboxItems({ storeCode, storeName }),
        getActiveReboxBox(storeFilter),
        AsyncStorage.getItem(MANIFEST_ITEMS_KEY),
        AsyncStorage.getItem(UPLOADED_ITEM_IMAGES_KEY),
      ]);

      const summaries = await fetchReboxBoxes(items, storeFilter);
      setAllReboxItems(items);
      setBoxSummaries(summaries);
      const savedMatchesExisting =
        savedActiveBox &&
        summaries.some((b) => b.boxNumber.toUpperCase() === savedActiveBox.toUpperCase());
      if (savedMatchesExisting && savedActiveBox) {
        setActiveBoxNumber(savedActiveBox);
      } else if (summaries.length > 0) {
        setActiveBoxNumber(summaries[0].boxNumber);
        setActiveReboxBox(summaries[0].boxNumber, storeFilter).catch(() => {});
      } else {
        setActiveBoxNumber(null);
      }

      if (storedManifest) {
        setManifestItems(JSON.parse(storedManifest) as ItemManifestRecord[]);
      }
      if (storedImages) {
        setUploadedItemImages(JSON.parse(storedImages) as Record<string, string>);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to sync stockroom boxes from Supabase', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, storeCode, storeName, storeFilter]);

  useFocusEffect(
    useCallback(() => {
      reloadHubData();
    }, [reloadHubData])
  );

  // Catalog & Manifest lookup maps
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

  const manifestItemsByCode = useMemo(() => {
    const map = new Map<string, ItemManifestRecord>();
    for (const it of manifestItems) {
      const normSku = normalizeLookupCode(it.sku);
      const normUpc = normalizeLookupCode(it.upc);
      if (normSku && !map.has(normSku)) map.set(normSku, it);
      if (normUpc && !map.has(normUpc)) map.set(normUpc, it);
      if (it.sku && !map.has(it.sku.toUpperCase())) map.set(it.sku.toUpperCase(), it);
      if (it.upc && !map.has(it.upc.toUpperCase())) map.set(it.upc.toUpperCase(), it);
    }
    return map;
  }, [manifestItems]);

  // Enrich all items with OpenSheet + Manifest descriptions & uploaded images
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
  }, [allReboxItems, catalogItemsByCode, manifestItemsByCode]);

  // Group enriched items by Box Number for rich card previews & Box Inspector modal
  const enrichedItemsByBox = useMemo(() => {
    const map = new Map<string, ReboxItem[]>();
    for (const item of enrichedAllItems) {
      const key = (item.boxNumber || 'UNASSIGNED').toUpperCase();
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [enrichedAllItems]);

  const suggestedNextBox = useMemo(() => suggestNextBoxNumber(boxSummaries), [boxSummaries]);
  const totalStockroomUnits = useMemo(
    () => enrichedAllItems.reduce((sum, item) => sum + item.qty, 0),
    [enrichedAllItems]
  );

  // Navigate to dedicated Rebox Scanner screen for a specific Box Number
  const openScannerForBox = useCallback(
    async (rawBoxNumber: string) => {
      const normalized = normalizeBoxNumber(rawBoxNumber);
      if (!normalized) {
        Alert.alert('Enter Box Number', 'Please enter or select a Box Number before scanning items.');
        return;
      }
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      await setActiveReboxBox(normalized, storeFilter);
      setActiveBoxNumber(normalized);
      setNewBoxInput('');
      setInspectingBoxNumber(null);

      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('ReboxScanner', {
          boxNumber: normalized,
          initialTab: 'current_box',
        });
      }
    },
    [navigation, storeFilter]
  );

  // Create an empty box on the hub without immediately opening camera
  const handlePreCreateBox = useCallback(
    async (rawBoxNumber: string) => {
      const normalized = normalizeBoxNumber(rawBoxNumber);
      if (!normalized) {
        Alert.alert('Enter Box Number', 'Type a Box Number (e.g. BOX-02) to add it to the list.');
        return;
      }
      try {
        await registerReboxBox(normalized, storeFilter);
        await setActiveReboxBox(normalized, storeFilter);
        setActiveBoxNumber(normalized);
        setNewBoxInput('');
        const summaries = await fetchReboxBoxes(allReboxItems, storeFilter);
        setBoxSummaries(summaries);
        showToast(`Created ${normalized} — tap "Scan Items" when ready!`, 'success');
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Could not create box.');
      }
    },
    [allReboxItems, showToast, storeFilter]
  );

  const handleConfirmRenameBox = async () => {
    if (!renamingBoxTarget) return;
    const cleanNew = normalizeBoxNumber(renameBoxInput);
    if (!cleanNew) {
      Alert.alert('Invalid Box Number', 'Please enter a valid Box Number.');
      return;
    }
    try {
      const updatedName = await renameReboxBox(renamingBoxTarget, cleanNew, storeFilter);
      if (inspectingBoxNumber?.toUpperCase() === renamingBoxTarget.toUpperCase()) {
        setInspectingBoxNumber(updatedName);
      }
      setRenamingBoxTarget(null);
      setRenameBoxInput('');
      showToast(`Renamed box to ${updatedName}`, 'success');
      await reloadHubData();
    } catch (err: any) {
      Alert.alert('Rename Failed', err?.message || 'Could not rename box.');
    }
  };

  const handleDeleteBox = (box: ReboxBoxSummary) => {
    const msg =
      box.itemCount > 0
        ? `Delete ${box.boxNumber} and remove all ${box.itemCount} SKUs (${box.totalUnits} units) from Supabase?`
        : `Remove empty box ${box.boxNumber} from the list?`;

    Alert.alert(`Delete ${box.boxNumber}?`, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Box',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntireReboxBox(box.boxNumber, storeFilter);
            if (inspectingBoxNumber?.toUpperCase() === box.boxNumber.toUpperCase()) {
              setInspectingBoxNumber(null);
            }
            showToast(`Deleted ${box.boxNumber}`, 'info');
            await reloadHubData();
          } catch (err: any) {
            Alert.alert('Delete Failed', err?.message || 'Failed to delete box.');
          }
        },
      },
    ]);
  };

  const handleOpenItemSearchInBrowser = useCallback(
    async (item: { upc?: string; sku?: string; description?: string }) => {
      const query = (item.upc || item.sku || item.description || '').trim();
      if (!query) return;
      const encoded = encodeURIComponent(query);
      const searchUrl = `https://www.google.com/search?q=${encoded}&udm=2`;
      try {
        await WebBrowser.openBrowserAsync(searchUrl, {
          toolbarColor: isDark ? '#131316' : '#ffffff',
          controlsColor: '#e5005c',
          showTitle: true,
        });
      } catch {
        try {
          await Linking.openURL(searchUrl);
        } catch {}
      }
    },
    [isDark]
  );

  const handleRequestUploadImage = useCallback(
    async (item: ReboxItem) => {
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

      const itemKey = getItemImageKey(item);
      setCheckingImageKey(itemKey);
      try {
        const existingUrl = await checkExistingProductImage(lookupCode);
        if (existingUrl) {
          if (cleanUpc) failedHubItemImagesCache.delete(cleanUpc);
          setUploadedItemImages((prev) => {
            const next = { ...prev, [itemKey]: existingUrl };
            if (cleanUpc) next[`upc:${cleanUpc}`] = existingUrl;
            if (cleanSku) next[`sku:${cleanSku}`] = existingUrl;
            AsyncStorage.setItem(UPLOADED_ITEM_IMAGES_KEY, JSON.stringify(next)).catch(() => {});
            return next;
          });
          showToast(`Found existing image for UPC ${lookupCode}`, 'success');
          return;
        }

        if (!cameraPermission?.granted) {
          await requestCameraPermission();
        }
        setUploadImageModalItem(item);
      } finally {
        setCheckingImageKey(null);
      }
    },
    [cameraPermission, requestCameraPermission, showToast]
  );

  const confirmRefillFromHub = async () => {
    if (!refillModalItem) return;
    const qty = parseInt(refillQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Enter a valid refill quantity.');
      return;
    }
    if (qty > refillModalItem.qty) {
      Alert.alert(
        'Exceeds Stored Quantity',
        `Only ${refillModalItem.qty} units are available in ${refillModalItem.boxNumber}.`
      );
      return;
    }
    try {
      const res = await refillItemFromBox(refillModalItem.id, qty);
      showToast(
        res.deleted
          ? `Took all ${qty} units from ${refillModalItem.boxNumber}`
          : `Refilled ${qty} units from ${refillModalItem.boxNumber} (${res.remainingQty} left)`,
        'success'
      );
      setRefillModalItem(null);
      await reloadHubData();
    } catch (err: any) {
      Alert.alert('Refill Failed', err?.message || 'Could not update Supabase.');
    }
  };

  const handleInlineQtyAdjust = async (item: ReboxItem, delta: number) => {
    try {
      await updateReboxItemQty(item.id, item.qty + delta);
      await reloadHubData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update quantity', 'error');
    }
  };

  const handleHoldDeleteSingleItem = async (item: ReboxItem) => {
    try {
      await deleteReboxItem(item.id, storeFilter);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      showToast(
        `Deleted "${item.description || item.sku || item.upc}" from ${item.boxNumber}`,
        'info'
      );
      await reloadHubData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not delete item.');
    }
  };

  // Filtered Stockroom Boxes (matches boxNumber OR any item SKU/UPC/Description inside!)
  const filteredBoxes = useMemo(() => {
    const q = boxFilterQuery.trim().toLowerCase();
    if (!q) return boxSummaries;
    const qNorm = normalizeLookupCode(q);

    return boxSummaries.filter((box) => {
      if (box.boxNumber.toLowerCase().includes(q)) return true;
      if (qNorm && normalizeLookupCode(box.boxNumber).includes(qNorm)) return true;

      const boxItems = enrichedItemsByBox.get(box.boxNumber.toUpperCase()) || [];
      return boxItems.some((it) => {
        if (
          (it.sku || '').toLowerCase().includes(q) ||
          (it.upc || '').toLowerCase().includes(q) ||
          (it.description || '').toLowerCase().includes(q)
        ) {
          return true;
        }
        if (qNorm) {
          return (
            normalizeLookupCode(it.sku).includes(qNorm) ||
            normalizeLookupCode(it.upc).includes(qNorm)
          );
        }
        return false;
      });
    });
  }, [boxSummaries, boxFilterQuery, enrichedItemsByBox]);

  // Filtered Refill Search Items
  const filteredRefillItems = useMemo(() => {
    const q = refillSearchQuery.trim().toLowerCase();
    if (!q) return enrichedAllItems;
    const qNorm = normalizeLookupCode(q);

    return enrichedAllItems.filter((item) => {
      if (
        (item.sku || '').toLowerCase().includes(q) ||
        (item.upc || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.boxNumber || '').toLowerCase().includes(q)
      ) {
        return true;
      }
      if (qNorm) {
        return (
          normalizeLookupCode(item.sku).includes(qNorm) ||
          normalizeLookupCode(item.upc).includes(qNorm) ||
          normalizeLookupCode(item.boxNumber).includes(qNorm)
        );
      }
      return false;
    });
  }, [enrichedAllItems, refillSearchQuery]);

  const inspectingBoxItems = useMemo(() => {
    if (!inspectingBoxNumber) return [];
    return enrichedItemsByBox.get(inspectingBoxNumber.toUpperCase()) || [];
  }, [inspectingBoxNumber, enrichedItemsByBox]);

  const runHubPdfExport = async (
    itemsToExport: ReboxItem[],
    scopedBox: string | undefined,
    keyId: string,
    action: 'save_to_device' | 'share'
  ) => {
    setExportingPdfKey(keyId);
    try {
      const normalizedImagesMap: Record<string, string> = { ...uploadedItemImages };
      for (const it of itemsToExport) {
        const key = getItemImageKey(it);
        const mapped = uploadedItemImages[key];
        if (mapped) {
          if (it.upc) normalizedImagesMap[`upc:${it.upc.trim()}`] = mapped;
          if (it.sku) normalizedImagesMap[`sku:${it.sku.trim()}`] = mapped;
          normalizedImagesMap[`${it.sku}_${it.upc}`] = mapped;
        }
      }

      const result = await downloadReboxPdf({
        items: itemsToExport,
        boxNumber: scopedBox || null,
        storeCode,
        storeName,
        uploadedItemImages: normalizedImagesMap,
        action,
      });

      if (result.cancelled) return;

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      showToast(
        `${result.savedToDevice ? 'Saved' : 'Exported'} ${result.itemCount} SKUs (${result.imagesEmbedded} photos) to ${result.fileName}`,
        'success'
      );
    } catch (err: any) {
      Alert.alert('PDF Export Failed', err?.message || 'Failed to generate Rebox PDF.');
    } finally {
      setExportingPdfKey(null);
    }
  };

  const handleDownloadHubPdf = (specificBoxNumber?: string) => {
    if (exportingPdfKey) return;

    const scopedBox = specificBoxNumber ? normalizeBoxNumber(specificBoxNumber) : undefined;
    const keyId = scopedBox || 'ALL';

    let itemsToExport: ReboxItem[] = [];
    if (scopedBox) {
      itemsToExport = enrichedItemsByBox.get(scopedBox.toUpperCase()) || [];
    } else if (hubMode === 'refill') {
      itemsToExport = filteredRefillItems;
    } else if (boxFilterQuery.trim()) {
      const allowedBoxes = new Set(filteredBoxes.map((b) => b.boxNumber.toUpperCase()));
      itemsToExport = enrichedAllItems.filter((it) =>
        allowedBoxes.has(normalizeBoxNumber(it.boxNumber).toUpperCase())
      );
    } else {
      itemsToExport = enrichedAllItems;
    }

    if (itemsToExport.length === 0) {
      showToast(
        scopedBox
          ? `No stored items in ${scopedBox} to export as PDF.`
          : 'No stored rebox items available to export as PDF.',
        'error'
      );
      return;
    }

    if (Platform.OS === 'android') {
      Alert.alert(
        scopedBox ? `Export ${scopedBox} PDF` : 'Export Rebox PDF',
        `Download ${itemsToExport.length} ${itemsToExport.length === 1 ? 'item' : 'items'} with product images as a PDF:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share / Print',
            onPress: () => {
              runHubPdfExport(itemsToExport, scopedBox, keyId, 'share');
            },
          },
          {
            text: 'Save to Phone',
            onPress: () => {
              runHubPdfExport(itemsToExport, scopedBox, keyId, 'save_to_device');
            },
          },
        ]
      );
      return;
    }

    runHubPdfExport(itemsToExport, scopedBox, keyId, 'share');
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      className={`flex-1 ${bgClass}`}
      style={{ flex: 1, backgroundColor: isDark ? '#131316' : '#f4f4f5' }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Toast Banner */}
      {toast && (
        <View
          style={{ zIndex: 999 }}
          className={`absolute left-4 right-4 top-16 flex-row items-center gap-2.5 rounded-xl border p-3 shadow-lg ${
            toast.type === 'success'
              ? 'border-[#22c55e] bg-[#163e26]/95'
              : toast.type === 'error'
                ? 'border-[#ef4444] bg-[#451a1a]/95'
                : isDark
                  ? 'border-[#3f3f46] bg-[#1f1f22]'
                  : 'border-[#e4e4e7] bg-[#ffffff]'
          }`}>
          {toast.type === 'success' ? (
            <CheckCircle color="#22c55e" size={16} />
          ) : toast.type === 'error' ? (
            <AlertTriangle color="#ef4444" size={16} />
          ) : (
            <BoxIcon color="#e5005c" size={16} />
          )}
          <Text
            className={`flex-1 font-hanken text-xs font-semibold ${
              toast.type === 'success' || toast.type === 'error'
                ? 'text-[#fafafa]'
                : textPrimaryClass
            }`}>
            {toast.text}
          </Text>
          <TouchableOpacity onPress={() => setToast(null)}>
            <X color="#a1a1aa" size={15} />
          </TouchableOpacity>
        </View>
      )}

      {/* Image Pinch-to-Zoom Modal */}
      <Modal visible={Boolean(imageZoomModal)} transparent animationType="fade">
        {imageZoomModal && (
          <HubImageZoomModalContent
            payload={imageZoomModal}
            isDark={isDark}
            textPrimaryClass={textPrimaryClass}
            textSecondaryClass={textSecondaryClass}
            onClose={() => setImageZoomModal(null)}
          />
        )}
      </Modal>

      {/* Camera Capture & Cloudinary Upload Modal (EXPO_CLOUDINARY_UPLOAD_PRESET=daisoimage) */}
      <Modal visible={Boolean(uploadImageModalItem)} transparent animationType="fade">
        {uploadImageModalItem && (
          <HubImageCaptureModalContent
            item={uploadImageModalItem}
            isDark={isDark}
            permission={cameraPermission}
            onRequestPermission={requestCameraPermission}
            onClose={() => setUploadImageModalItem(null)}
            onUploaded={(result) => {
              const cleanUpc = (uploadImageModalItem.upc || '').trim();
              const cleanSku = (uploadImageModalItem.sku || '').trim();
              const itemKey = getItemImageKey(uploadImageModalItem);
              if (cleanUpc) {
                failedHubItemImagesCache.delete(cleanUpc);
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
              setUploadImageModalItem(null);
              showToast(
                result.alreadyExisted
                  ? `Loaded existing image for UPC ${result.publicId}`
                  : `Uploaded image as ${result.publicId} (${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET})`,
                'success'
              );
            }}
          />
        )}
      </Modal>

      {/* Rename Box Modal */}
      <Modal visible={Boolean(renamingBoxTarget)} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/75 px-6">
          <View
            className={`w-full max-w-sm rounded-2xl border p-5 ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                Rename {renamingBoxTarget}
              </Text>
              <TouchableOpacity onPress={() => setRenamingBoxTarget(null)}>
                <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
              </TouchableOpacity>
            </View>
            <Text className={`mb-2 font-hanken text-xs ${textSecondaryClass}`}>
              Enter new physical box label:
            </Text>
            <TextInput
              value={renameBoxInput}
              onChangeText={setRenameBoxInput}
              placeholder="e.g. BOX-05"
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              autoCapitalize="characters"
              autoFocus
              className={`mb-4 h-11 rounded-xl border px-3 font-jetbrains text-sm font-bold ${
                isDark
                  ? 'border-[#3f3f46] bg-[#131316] text-[#fafafa]'
                  : 'border-[#d4d4d8] bg-[#fafafa] text-[#18181b]'
              }`}
            />
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setRenamingBoxTarget(null)}
                className={`flex-1 items-center justify-center rounded-xl border py-2.5 ${innerCardBgClass}`}>
                <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRenameBox}
                className="flex-1 items-center justify-center rounded-xl bg-[#e5005c] py-2.5">
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Refill Selling Area Modal */}
      <Modal visible={Boolean(refillModalItem)} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/75 px-5">
          <View
            className={`w-full max-w-md rounded-2xl border p-5 ${
              isDark ? 'border-[#3f3f46] bg-[#1f1f22]' : 'border-[#e4e4e7] bg-[#ffffff]'
            }`}>
            {refillModalItem && (
              <>
                <View className="mb-3 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#22c55e]/15">
                      <Package color="#22c55e" size={17} />
                    </View>
                    <View>
                      <Text className={`font-hanken text-base font-bold ${textPrimaryClass}`}>
                        Refill Selling Area
                      </Text>
                      <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                        FROM STOCKROOM {refillModalItem.boxNumber}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setRefillModalItem(null)}>
                    <X color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                  </TouchableOpacity>
                </View>

                <View className={`mb-3 rounded-xl border p-3 ${innerCardBgClass}`}>
                  <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                    {refillModalItem.description || 'Unnamed Item'}
                  </Text>
                  <View className="mt-1.5 flex-row flex-wrap gap-1.5">
                    <View className="rounded bg-[#e5005c] px-2 py-0.5">
                      <Text className="font-jetbrains text-[10px] font-bold text-[#ffffff]">
                        BOX: {refillModalItem.boxNumber}
                      </Text>
                    </View>
                    {refillModalItem.sku ? (
                      <View className="rounded border border-[#e5005c]/30 bg-[#e5005c]/10 px-2 py-0.5">
                        <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                          SKU: {refillModalItem.sku}
                        </Text>
                      </View>
                    ) : null}
                    <View className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5">
                      <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                        STORED: {refillModalItem.qty} UNITS
                      </Text>
                    </View>
                  </View>
                </View>

                <Text
                  className={`mb-1.5 font-jetbrains text-[11px] font-bold ${textSecondaryClass}`}>
                  UNITS TO TAKE FOR DISPLAY:
                </Text>
                <View className="mb-4 flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      const cur = parseInt(refillQtyInput, 10) || 1;
                      setRefillQtyInput(String(Math.max(1, cur - 1)));
                    }}
                    className={`h-11 w-11 items-center justify-center rounded-xl border ${innerCardBgClass}`}>
                    <Minus color={isDark ? '#fafafa' : '#18181b'} size={18} />
                  </TouchableOpacity>
                  <TextInput
                    value={refillQtyInput}
                    onChangeText={setRefillQtyInput}
                    keyboardType="number-pad"
                    className={`h-11 flex-1 rounded-xl border text-center font-jetbrains text-base font-bold ${
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
                    className={`h-11 w-11 items-center justify-center rounded-xl border ${innerCardBgClass}`}>
                    <Plus color={isDark ? '#fafafa' : '#18181b'} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setRefillQtyInput(String(refillModalItem.qty))}
                    className="h-11 items-center justify-center rounded-xl bg-[#22c55e]/20 px-3">
                    <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                      TAKE ALL
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setRefillModalItem(null)}
                    className={`flex-1 items-center justify-center rounded-xl border py-3 ${innerCardBgClass}`}>
                    <Text className={`font-jetbrains text-xs font-bold ${textSecondaryClass}`}>
                      CANCEL
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmRefillFromHub}
                    className="flex-1 items-center justify-center rounded-xl bg-[#22c55e] py-3">
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

      {/* Box Contents Inspector Modal */}
      <Modal visible={Boolean(inspectingBoxNumber)} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/75">
          <View
            className={`max-h-[85%] rounded-t-3xl border-t p-4 ${
              isDark ? 'border-[#3f3f46] bg-[#18181b]' : 'border-[#e4e4e7] bg-[#f4f4f5]'
            }`}>
            {inspectingBoxNumber && (
              <>
                <View className="mb-3 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#e5005c]/15">
                      <BoxIcon color="#e5005c" size={20} />
                    </View>
                    <View>
                      <View className="flex-row items-center gap-2">
                        <Text className={`font-jetbrains text-lg font-bold ${textPrimaryClass}`}>
                          {inspectingBoxNumber}
                        </Text>
                        <View className="rounded-md bg-[#e5005c]/15 px-2 py-0.5">
                          <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                            {inspectingBoxItems.length} SKUs ·{' '}
                            {inspectingBoxItems.reduce((s, i) => s + i.qty, 0)} Units
                          </Text>
                        </View>
                      </View>
                      <Text className={`font-hanken text-xs ${textSecondaryClass}`}>
                        Physical Stockroom Box Contents
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    {inspectingBoxItems.length > 0 && (
                      <TouchableOpacity
                        onPress={() => handleDownloadHubPdf(inspectingBoxNumber)}
                        disabled={Boolean(exportingPdfKey)}
                        className="h-9 flex-row items-center gap-1 rounded-xl border border-[#22c55e]/50 bg-[#22c55e]/15 px-2.5">
                        {exportingPdfKey === normalizeBoxNumber(inspectingBoxNumber) ? (
                          <ActivityIndicator size={12} color="#22c55e" />
                        ) : (
                          <Download color="#22c55e" size={13} />
                        )}
                        <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                          PDF
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        setRenameBoxInput(inspectingBoxNumber);
                        setRenamingBoxTarget(inspectingBoxNumber);
                      }}
                      className={`h-9 w-9 items-center justify-center rounded-xl border ${cardBgClass}`}>
                      <Edit3 color={isDark ? '#a1a1aa' : '#71717a'} size={15} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setInspectingBoxNumber(null)}
                      className={`h-9 w-9 items-center justify-center rounded-xl border ${cardBgClass}`}>
                      <X color={isDark ? '#fafafa' : '#18181b'} size={17} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => openScannerForBox(inspectingBoxNumber)}
                  activeOpacity={0.85}
                  className="mb-3 flex-row items-center justify-center gap-2 rounded-xl bg-[#e5005c] py-3">
                  <Scan color="#ffffff" size={16} />
                  <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                    SCAN & ADD ITEMS TO {inspectingBoxNumber}
                  </Text>
                  <ArrowRight color="#ffffff" size={15} />
                </TouchableOpacity>

                <FlatList
                  data={inspectingBoxItems}
                  keyExtractor={(it) => it.id}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className={`items-center rounded-2xl border p-8 ${cardBgClass}`}>
                      <Package color={isDark ? '#52525b' : '#a1a1aa'} size={34} />
                      <Text className={`mt-2 font-hanken text-sm font-bold ${textPrimaryClass}`}>
                        {inspectingBoxNumber} is empty
                      </Text>
                      <Text
                        className={`mt-1 text-center font-hanken text-xs ${textSecondaryClass}`}>
                        Tap the button above to scan items into this storage box.
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <HubReboxItemCard
                      item={item}
                      isDark={isDark}
                      textPrimaryClass={textPrimaryClass}
                      textSecondaryClass={textSecondaryClass}
                      uploadedImageUrl={uploadedItemImages[getItemImageKey(item)]}
                      isCheckingImage={checkingImageKey === getItemImageKey(item)}
                      onOpenSearchInBrowser={handleOpenItemSearchInBrowser}
                      onPressPreviewImage={(payload) => setImageZoomModal(payload)}
                      onPressUploadImage={(target) => handleRequestUploadImage(target)}
                      onRefill={(target) => {
                        setRefillModalItem(target);
                        setRefillQtyInput('1');
                      }}
                      onQtyAdjust={handleInlineQtyAdjust}
                      onHoldDelete={handleHoldDeleteSingleItem}
                    />
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Top Header (Matches Receiving Dashboard) */}
      <View
        className={`flex-row items-center justify-between border-b px-4 py-2.5 ${headerBgClass}`}>
        <View className="flex-1 flex-row items-center gap-2.5 pr-2">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#e5005c]/15">
            <Boxes color="#e5005c" size={20} />
          </View>
          <View className="flex-1">
            <Text
              className={`font-hanken text-base font-bold ${textPrimaryClass}`}
              numberOfLines={1}>
              Rebox Stockroom
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              <Text
                className="font-jetbrains text-[9px] font-bold text-[#22c55e]"
                numberOfLines={1}>
                SELECT BOX FIRST
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          <TouchableOpacity
            onPress={reloadHubData}
            activeOpacity={0.8}
            className={`flex-row items-center gap-1 rounded-lg border px-2 py-1.5 ${innerCardBgClass}`}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#e5005c" />
            ) : (
              <RefreshCw color="#e5005c" size={12} />
            )}
            <Text className={`font-jetbrains text-[10px] font-bold ${textPrimaryClass}`}>SYNC</Text>
          </TouchableOpacity>

          <View
            className={`max-w-[118px] flex-row items-center gap-1 rounded-lg border px-2 py-1.5 ${innerCardBgClass}`}>
            <Store color="#e5005c" size={12} />
            <Text
              className={`flex-shrink font-jetbrains text-[10px] font-bold ${textPrimaryClass}`}
              numberOfLines={1}>
              {storeName ? `${storeName}` : storeCode || 'DAISO'}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={hubMode === 'boxes' ? (filteredBoxes as any[]) : (filteredRefillItems as any[])}
        keyExtractor={(entry, idx) =>
          hubMode === 'boxes'
            ? `box_${(entry as ReboxBoxSummary).boxNumber}`
            : `item_${(entry as ReboxItem).id || idx}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            {/* KPI Summary Row */}
            <View className="mb-3.5 flex-row gap-2">
              <View className={`flex-1 rounded-xl border p-3 ${cardBgClass}`}>
                <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
                  STORAGE BOXES
                </Text>
                <Text className="mt-1 font-jetbrains text-lg font-bold text-[#e5005c]">
                  {boxSummaries.length}
                </Text>
              </View>
              <View className={`flex-1 rounded-xl border p-3 ${cardBgClass}`}>
                <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
                  STORED SKUS
                </Text>
                <Text className={`mt-1 font-jetbrains text-lg font-bold ${textPrimaryClass}`}>
                  {enrichedAllItems.length}
                </Text>
              </View>
              <View className={`flex-1 rounded-xl border p-3 ${cardBgClass}`}>
                <Text className={`font-jetbrains text-[9px] font-bold ${textSecondaryClass}`}>
                  TOTAL UNITS
                </Text>
                <Text className="mt-1 font-jetbrains text-lg font-bold text-[#22c55e]">
                  {totalStockroomUnits}
                </Text>
              </View>
            </View>

            {/* STEP 1: Select or Create Box Number Card */}
            <View className={`mb-4 rounded-2xl border p-4 ${cardBgClass}`}>
              <View className="mb-2.5 flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <View className="rounded-md bg-[#e5005c]/15 px-2 py-0.5">
                    <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                      STEP 1
                    </Text>
                  </View>
                  <Text
                    className={`flex-1 font-hanken text-sm font-bold ${textPrimaryClass}`}
                    numberOfLines={1}>
                    Select or Create Box
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setNewBoxInput(suggestedNextBox)}
                  activeOpacity={0.8}
                  className="flex-row items-center gap-1 rounded-lg border border-[#e5005c]/40 bg-[#e5005c]/10 px-2.5 py-1">
                  <Sparkles color="#e5005c" size={11} />
                  <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                    SUGGEST {suggestedNextBox}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text className={`mb-3 font-hanken text-xs ${textSecondaryClass}`}>
                Enter the physical stockroom box number first, then scan items into that box.
              </Text>

              <View className="mb-2.5 flex-row items-center gap-2">
                <View
                  className={`h-11 flex-1 flex-row items-center rounded-xl border px-3 ${
                    isDark ? 'border-[#3f3f46] bg-[#131316]' : 'border-[#d4d4d8] bg-[#fafafa]'
                  }`}>
                  <BoxIcon color="#e5005c" size={16} />
                  <TextInput
                    value={newBoxInput}
                    onChangeText={setNewBoxInput}
                    placeholder={`Enter box (e.g. ${suggestedNextBox} or B-12)...`}
                    placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                    autoCapitalize="characters"
                    returnKeyType="go"
                    onSubmitEditing={() => {
                      if (newBoxInput.trim()) {
                        openScannerForBox(newBoxInput);
                      }
                    }}
                    className={`ml-2 flex-1 font-jetbrains text-xs font-bold ${textPrimaryClass}`}
                  />
                  {newBoxInput.length > 0 && (
                    <TouchableOpacity onPress={() => setNewBoxInput('')}>
                      <X color="#71717a" size={15} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handlePreCreateBox(newBoxInput.trim() || suggestedNextBox)}
                  activeOpacity={0.8}
                  className={`h-11 items-center justify-center rounded-xl border px-3 ${innerCardBgClass}`}>
                  <Text className={`font-jetbrains text-[10px] font-bold ${textPrimaryClass}`}>
                    + ADD BOX
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() =>
                  openScannerForBox(newBoxInput.trim() || activeBoxNumber || suggestedNextBox)
                }
                activeOpacity={0.85}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-[#e5005c] py-3.5 shadow-sm">
                <Scan color="#ffffff" size={17} />
                <Text className="font-jetbrains text-xs font-bold text-[#ffffff]">
                  {newBoxInput.trim()
                    ? `OPEN ${normalizeBoxNumber(newBoxInput)} & SCAN ITEMS`
                    : activeBoxNumber
                      ? `CONTINUE SCANNING IN ${activeBoxNumber}`
                      : `START SCANNING IN ${suggestedNextBox}`}
                </Text>
                <ArrowRight color="#ffffff" size={16} />
              </TouchableOpacity>
            </View>

            {/* Segmented Mode Switcher: Stockroom Boxes vs Refill Search */}
            <View className={`mb-3 flex-row rounded-xl border p-1 ${cardBgClass}`}>
              <TouchableOpacity
                onPress={() => setHubMode('boxes')}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                  hubMode === 'boxes' ? 'bg-[#e5005c]' : 'bg-transparent'
                }`}>
                <Layers
                  color={hubMode === 'boxes' ? '#ffffff' : isDark ? '#a1a1aa' : '#71717a'}
                  size={14}
                />
                <Text
                  className={`font-jetbrains text-[11px] font-bold ${
                    hubMode === 'boxes' ? 'text-[#ffffff]' : textSecondaryClass
                  }`}>
                  BOX NUMBERS ({boxSummaries.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setHubMode('refill')}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                  hubMode === 'refill' ? 'bg-[#22c55e]' : 'bg-transparent'
                }`}>
                <Search
                  color={hubMode === 'refill' ? '#ffffff' : isDark ? '#a1a1aa' : '#71717a'}
                  size={14}
                />
                <Text
                  className={`font-jetbrains text-[11px] font-bold ${
                    hubMode === 'refill' ? 'text-[#ffffff]' : textSecondaryClass
                  }`}>
                  FIND FOR REFILL ({enrichedAllItems.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contextual Search Bar + PDF Download Button */}
            <View className="mb-3.5 flex-row items-center gap-2">
              <View
                className={`h-11 flex-1 flex-row items-center rounded-xl border px-3 ${cardBgClass}`}>
                <Search color={isDark ? '#71717a' : '#a1a1aa'} size={16} />
                <TextInput
                  value={hubMode === 'boxes' ? boxFilterQuery : refillSearchQuery}
                  onChangeText={hubMode === 'boxes' ? setBoxFilterQuery : setRefillSearchQuery}
                  placeholder={
                    hubMode === 'boxes'
                      ? 'Search Box Number or item inside box...'
                      : 'Search SKU, UPC, Description, or Box Number...'
                  }
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  className={`ml-2 flex-1 font-hanken text-xs ${textPrimaryClass}`}
                />
                {(hubMode === 'boxes' ? boxFilterQuery : refillSearchQuery).length > 0 && (
                  <TouchableOpacity
                    onPress={() =>
                      hubMode === 'boxes' ? setBoxFilterQuery('') : setRefillSearchQuery('')
                    }>
                    <X color="#71717a" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleDownloadHubPdf()}
                disabled={Boolean(exportingPdfKey)}
                activeOpacity={0.82}
                className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl border border-[#22c55e]/50 bg-[#22c55e]/15 px-3">
                {exportingPdfKey === 'ALL' ? (
                  <ActivityIndicator size={13} color="#22c55e" />
                ) : (
                  <Download color="#22c55e" size={14} />
                )}
                <Text className="font-jetbrains text-[11px] font-bold text-[#22c55e]">
                  {exportingPdfKey === 'ALL' ? 'PDF...' : 'PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className={`items-center rounded-2xl border p-8 ${cardBgClass}`}>
            <Boxes color={isDark ? '#52525b' : '#a1a1aa'} size={36} />
            <Text className={`mt-3 font-hanken text-base font-bold ${textPrimaryClass}`}>
              {hubMode === 'boxes' ? 'No Stockroom Boxes Yet' : 'No Matching Stored Items'}
            </Text>
            <Text className={`mt-1 text-center font-hanken text-xs ${textSecondaryClass}`}>
              {hubMode === 'boxes'
                ? `Create ${suggestedNextBox} above to start scanning and storing excess display items.`
                : 'Try searching by another SKU, UPC barcode, item name, or box number.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (hubMode === 'refill') {
            const reboxItem = item as ReboxItem;
            return (
              <HubReboxItemCard
                item={reboxItem}
                isDark={isDark}
                textPrimaryClass={textPrimaryClass}
                textSecondaryClass={textSecondaryClass}
                uploadedImageUrl={uploadedItemImages[getItemImageKey(reboxItem)]}
                isCheckingImage={checkingImageKey === getItemImageKey(reboxItem)}
                showOpenBoxButton
                onOpenBoxScanner={(boxNum) => openScannerForBox(boxNum)}
                onOpenSearchInBrowser={handleOpenItemSearchInBrowser}
                onPressPreviewImage={(payload) => setImageZoomModal(payload)}
                onPressUploadImage={(target) => handleRequestUploadImage(target)}
                onRefill={(target) => {
                  setRefillModalItem(target);
                  setRefillQtyInput('1');
                }}
                onHoldDelete={handleHoldDeleteSingleItem}
              />
            );
          }

          const box = item as ReboxBoxSummary;
          const isCurrentActive =
            activeBoxNumber && activeBoxNumber.toUpperCase() === box.boxNumber.toUpperCase();
          const boxItems = enrichedItemsByBox.get(box.boxNumber.toUpperCase()) || [];
          const previewList = boxItems.slice(0, 3);

          return (
            <View
              className={`mb-3.5 overflow-hidden rounded-2xl border p-4 ${
                isCurrentActive
                  ? 'border-[#e5005c] bg-[#e5005c]/5'
                  : isDark
                    ? 'border-[#3f3f46] bg-[#1b1b1e]'
                    : 'border-[#e4e4e7] bg-[#ffffff]'
              }`}>
              {/* Box Number Header Row */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setInspectingBoxNumber(box.boxNumber)}
                className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View
                    className={`h-12 w-12 items-center justify-center rounded-xl border ${
                      isCurrentActive
                        ? 'border-[#e5005c] bg-[#e5005c]'
                        : 'border-[#e5005c]/30 bg-[#e5005c]/10'
                    }`}>
                    <BoxIcon color={isCurrentActive ? '#ffffff' : '#e5005c'} size={22} />
                  </View>

                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className={`font-jetbrains text-lg font-bold ${textPrimaryClass}`}>
                        {box.boxNumber}
                      </Text>
                      {isCurrentActive && (
                        <View className="rounded bg-[#e5005c]/20 px-1.5 py-0.5">
                          <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">
                            ACTIVE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                      Updated {formatRelativeTime(box.lastUpdated)}
                    </Text>
                  </View>
                </View>

                <View className="items-end">
                  {box.isEmpty || box.itemCount === 0 ? (
                    <View className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-2.5 py-1">
                      <Text className="font-jetbrains text-[10px] font-bold text-[#eab308]">
                        EMPTY · READY
                      </Text>
                    </View>
                  ) : (
                    <View className="items-end">
                      <View className="rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-2.5 py-1">
                        <Text className="font-jetbrains text-xs font-bold text-[#22c55e]">
                          {box.totalUnits} UNITS
                        </Text>
                      </View>
                      <Text className={`mt-0.5 font-jetbrains text-[10px] ${textSecondaryClass}`}>
                        {box.itemCount} {box.itemCount === 1 ? 'SKU' : 'SKUs'} stored
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Stored Items Preview inside Box Card (Hold item row 3s to delete) */}
              {previewList.length > 0 && (
                <View className={`mt-3 rounded-xl border p-2.5 ${innerCardBgClass}`}>
                  {previewList.map((previewItem, i) => (
                    <HubBoxPreviewItemRow
                      key={previewItem.id}
                      item={previewItem}
                      index={i}
                      uploadedImageUrl={uploadedItemImages[getItemImageKey(previewItem)]}
                      isDark={isDark}
                      textPrimaryClass={textPrimaryClass}
                      textSecondaryClass={textSecondaryClass}
                      onPressBox={() => setInspectingBoxNumber(box.boxNumber)}
                      onHoldDelete={handleHoldDeleteSingleItem}
                    />
                  ))}
                  {boxItems.length > 3 && (
                    <TouchableOpacity onPress={() => setInspectingBoxNumber(box.boxNumber)}>
                      <Text className="mt-2 text-center font-jetbrains text-[10px] font-bold text-[#e5005c]">
                        + {boxItems.length - 3} more SKUs in {box.boxNumber}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Action Buttons Row */}
              <View className="mt-3 flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => openScannerForBox(box.boxNumber)}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#e5005c] py-2.5">
                  <Scan color="#ffffff" size={14} />
                  <Text className="font-jetbrains text-[11px] font-bold text-[#ffffff]">
                    SCAN ITEMS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setInspectingBoxNumber(box.boxNumber)}
                  activeOpacity={0.8}
                  className={`flex-row items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 ${innerCardBgClass}`}>
                  <Layers color={isDark ? '#fafafa' : '#18181b'} size={14} />
                  <Text className={`font-jetbrains text-[11px] font-bold ${textPrimaryClass}`}>
                    VIEW ({box.itemCount})
                  </Text>
                </TouchableOpacity>

                {box.itemCount > 0 && (
                  <TouchableOpacity
                    onPress={() => handleDownloadHubPdf(box.boxNumber)}
                    disabled={Boolean(exportingPdfKey)}
                    activeOpacity={0.8}
                    className="h-10 w-10 items-center justify-center rounded-xl border border-[#22c55e]/45 bg-[#22c55e]/15">
                    {exportingPdfKey === normalizeBoxNumber(box.boxNumber) ? (
                      <ActivityIndicator size={13} color="#22c55e" />
                    ) : (
                      <Download color="#22c55e" size={14} />
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleDeleteBox(box)}
                  activeOpacity={0.8}
                  className={`h-10 w-10 items-center justify-center rounded-xl border ${innerCardBgClass}`}>
                  <Trash2 color="#ef4444" size={14} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
