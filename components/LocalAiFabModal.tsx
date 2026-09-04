import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
  Keyboard,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { X, Send, Sparkles, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/theme';
import { useLlamaModel } from '../hooks/useLlamaModel';
import {
  askLocalHybridAssistant,
  fetchDaizoFullDataset,
  type DaizoDataset,
  getCachedDaizoDataset,
} from '../services/localAiService';

// expo-image requires native module 'ExpoImage' compiled into the APK.
// On dev client binaries built before expo-image was linked, requiring expo-image causes:
// [Error: Cannot find native module 'ExpoImage']
// SafeExpoImage checks native registration first so it works seamlessly both on live APK and future native builds.
let SafeExpoImage: any = Image;
let hasNativeImage = false;
try {
  // @ts-ignore
  hasNativeImage = !!(global?.expo?.modules?.ExpoImage || global?.ExpoModules?.ExpoImage);
  if (hasNativeImage) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoImageModule = require('expo-image');
    if (ExpoImageModule?.Image) {
      SafeExpoImage = ExpoImageModule.Image;
    } else {
      hasNativeImage = false;
    }
  }
} catch {
  SafeExpoImage = Image;
  hasNativeImage = false;
}

const DAIZO_LOADING_ASSET = hasNativeImage
  ? require('../assets/daizo-no-wifi.webp')
  : require('../assets/daizo-no-wifi.png');

// Module-scoped in-flight fetch promise to prevent concurrent duplicate fetching
let inFlightFetchPromise: Promise<DaizoDataset> | null = null;

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

function DaizoTypingIndicator({
  borderClass,
  cardBgClass,
  textSecondaryClass,
}: {
  borderClass: string;
  cardBgClass: string;
  textSecondaryClass: string;
}) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createPulse = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createPulse(dot1, 0);
    const anim2 = createPulse(dot2, 200);
    const anim3 = createPulse(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View className="my-2 flex-row items-end justify-start gap-2.5">
      <Image
        source={require('../assets/DaizoChatBot.jpeg')}
        className="mb-0.5 h-8 w-8 rounded-full border border-[#e5005c]/30"
        resizeMode="cover"
      />
      <View
        className={`flex-row items-center gap-2.5 rounded-2xl border px-4 py-3.5 ${borderClass} ${cardBgClass}`}>
        <View className="flex-row items-center gap-1.5">
          <Animated.View
            style={{ opacity: dot1, transform: [{ scale: dot1 }] }}
            className="h-2.5 w-2.5 rounded-full bg-[#e5005c]"
          />
          <Animated.View
            style={{ opacity: dot2, transform: [{ scale: dot2 }] }}
            className="h-2.5 w-2.5 rounded-full bg-[#e5005c]"
          />
          <Animated.View
            style={{ opacity: dot3, transform: [{ scale: dot3 }] }}
            className="h-2.5 w-2.5 rounded-full bg-[#e5005c]"
          />
        </View>
        <Text className={`font-jetbrains text-xs font-semibold italic ${textSecondaryClass}`}>
          Daizo is typing...
        </Text>
      </View>
    </View>
  );
}

export interface LocalAiFabModalProps {
  tableName?: string;
  selectFields?: string;
  localStorageKeys?: string[];
  isOpenControlled?: boolean;
  onCloseControlled?: () => void;
  hideFab?: boolean;
}

export function LocalAiFabModal({
  tableName = 'dlr_records',
  selectFields = '*',
  localStorageKeys = [
    'manifest_cids',
    'scanned_cids',
    'manifest_items',
    'scanned_items',
    'item_expiry_dates',
  ],
  isOpenControlled,
  onCloseControlled,
  hideFab = false,
}: LocalAiFabModalProps) {
  const { isDark } = useTheme();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenControlled !== undefined ? isOpenControlled : internalIsOpen;
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Konnichiwa! Kamusta po! Ako si Daizo, ang iyong assistant para sa receiving & inventory dito sa Daiso Japan. Tanungin mo ako tungkol sa uploaded Manifest CSV (CID, TRF, SKU, UPC, QTY), Product Catalog, o Item DLR records! Ano ang maitutulong ko sa inyo ngayon?",
    },
  ]);
  const [isInferencing, setIsInferencing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Model & data loading states (persists in memory during app session)
  const { context, isReady, downloadProgress, statusMessage } = useLlamaModel();
  const [dataset, setDataset] = useState<DaizoDataset | null>(() => getCachedDaizoDataset());
  const [isLoadingData, setIsLoadingData] = useState(() => !getCachedDaizoDataset());
  const [dataLoadingStatus, setDataLoadingStatus] = useState('Syncing records...');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const windowHeight = Dimensions.get('window').height;

  // Fetch all datasets once per app session (or when user manually taps refresh)
  const loadAllData = useCallback(async (isManualRefresh = false) => {
    // If not a manual refresh and we already have cached data in memory for this session, reuse immediately
    const existingCache = getCachedDaizoDataset();
    if (!isManualRefresh && existingCache) {
      setDataset(existingCache);
      setIsLoadingData(false);
      return;
    }

    try {
      setIsLoadingData(true);
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      if (!inFlightFetchPromise || isManualRefresh) {
        inFlightFetchPromise = fetchDaizoFullDataset((status) => {
          setDataLoadingStatus(status);
        });
      }

      const [freshData] = await Promise.all([
        inFlightFetchPromise,
        isManualRefresh ? new Promise((resolve) => setTimeout(resolve, 1200)) : Promise.resolve(),
      ]);
      setDataset(freshData);
    } catch (err) {
      console.warn('[LocalAiFabModal] Error loading datasets:', err);
    } finally {
      inFlightFetchPromise = null;
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const existing = getCachedDaizoDataset();
      if (existing) {
        setDataset(existing);
        setIsLoadingData(false);
      } else {
        loadAllData(false);
      }
    }
  }, [isOpen, loadAllData]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e?.endCoordinates?.height || 0);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0 || isInferencing) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isInferencing, keyboardHeight]);

  const handleOpen = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setInternalIsOpen(true);
  };

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (onCloseControlled) {
      onCloseControlled();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isInferencing) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
    };

    // Render user message immediately; assistant message renders after reply finishes
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsInferencing(true);

    try {
      let accumulated = '';
      const response = await askLocalHybridAssistant(textToSend, context, {
        supabaseTable: tableName,
        supabaseFields: selectFields,
        localStorageKeys,
        dataset: dataset || getCachedDaizoDataset(),
        onStreamToken: (token) => {
          accumulated += token;
        },
      });

      const defaultNaturalFallback =
        '### 🌸 Konnichiwa! Kamusta po!\nPasensya na po, hindi ko nahanap ang record sa ating system. Baka may kaunting typo sa SKU, UPC, o CID? Ano po ang maitutulong ko sa inyo sa Daiso Japan? 😊';
      const replyText = (response || accumulated || defaultNaturalFallback).trim();

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: replyText,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.warn('[LocalAiFabModal] Inference failed:', err);
      const errorMessage: Message = {
        id: `ai_err_${Date.now()}`,
        sender: 'assistant',
        text: 'Pasensya na, nagkaroon ng saglit na aberya sa pagsagot. Pakisubukan pong magtanong muli.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsInferencing(false);
    }
  };

  // Theme-tailored class variables
  const modalBgClass = isDark ? 'bg-[#131316]' : 'bg-[#ffffff]';
  const cardBgClass = isDark ? 'bg-[#1f1f22]' : 'bg-[#f4f4f5]';
  const borderClass = isDark ? 'border-[#2a2a2d]' : 'border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  const markdownStyles = useMemo(
    () => ({
      body: {
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 15,
        lineHeight: 22,
        color: isDark ? '#fafafa' : '#18181b',
      },
      heading1: {
        fontFamily: 'JetBrainsMono_700Bold',
        fontSize: 18,
        lineHeight: 24,
        color: '#e5005c',
        marginTop: 6,
        marginBottom: 4,
      },
      heading2: {
        fontFamily: 'JetBrainsMono_700Bold',
        fontSize: 16,
        lineHeight: 22,
        color: '#e5005c',
        marginTop: 4,
        marginBottom: 2,
      },
      heading3: {
        fontFamily: 'JetBrainsMono_700Bold',
        fontSize: 15,
        lineHeight: 20,
        color: '#e5005c',
        marginTop: 4,
        marginBottom: 2,
      },
      strong: {
        fontFamily: 'JetBrainsMono_700Bold',
        fontWeight: 'bold' as const,
        color: isDark ? '#ffffff' : '#09090b',
      },
      em: {
        fontStyle: 'italic' as const,
        color: isDark ? '#d4d4d8' : '#3f3f46',
      },
      paragraph: {
        marginTop: 1,
        marginBottom: 3,
        fontSize: 15,
        lineHeight: 22,
      },
      bullet_list: {
        marginVertical: 2,
      },
      bullet_list_icon: {
        color: '#e5005c',
        fontSize: 15,
        lineHeight: 22,
        marginRight: 6,
      },
      ordered_list_icon: {
        color: '#e5005c',
        fontFamily: 'JetBrainsMono_700Bold',
        fontSize: 14,
        lineHeight: 22,
        marginRight: 6,
      },
      list_item: {
        marginVertical: 1,
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
      },
      code_inline: {
        backgroundColor: isDark ? '#27272a' : '#e4e4e7',
        fontFamily: 'JetBrainsMono_400Regular',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
        color: '#e5005c',
        fontSize: 13,
      },
      code_block: {
        backgroundColor: isDark ? '#141416' : '#f4f4f5',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        marginVertical: 4,
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 13,
      },
      fence: {
        backgroundColor: isDark ? '#141416' : '#f4f4f5',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        marginVertical: 4,
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 13,
      },
      table: {
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        borderRadius: 8,
        marginVertical: 4,
      },
      th: {
        backgroundColor: isDark ? '#27272a' : '#f4f4f5',
        padding: 4,
        fontFamily: 'JetBrainsMono_700Bold',
      },
      td: {
        padding: 4,
        borderColor: isDark ? '#27272a' : '#e4e4e7',
      },
      blockquote: {
        backgroundColor: isDark ? 'rgba(229,0,92,0.1)' : 'rgba(229,0,92,0.06)',
        borderLeftColor: '#e5005c',
        borderLeftWidth: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginVertical: 3,
        borderRadius: 4,
      },
      hr: {
        backgroundColor: isDark ? '#27272a' : '#e4e4e7',
        height: 1,
        marginVertical: 6,
      },
    }),
    [isDark]
  );

  return (
    <>
      {/* Floating Action Button (FAB) */}
      {!hideFab && (
        <TouchableOpacity
          accessibilityLabel="Daizo"
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={handleOpen}
          className="absolute bottom-24 right-5 z-50 h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[#e5005c]/40 bg-[#e5005c] shadow-xl shadow-[#e5005c]/30">
          <Image
            source={require('../assets/DaizoChatBot.jpeg')}
            className="h-12 w-12 rounded-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* Slide-Up Chat Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isOpen}
        statusBarTranslucent
        onRequestClose={handleClose}>
        <View style={{ paddingBottom: keyboardHeight }} className="flex-1 justify-end bg-black/60">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (keyboardHeight > 0) {
                Keyboard.dismiss();
              } else {
                handleClose();
              }
            }}
            className="flex-1"
          />
          <View
            style={{
              height:
                keyboardHeight > 0
                  ? Math.min(windowHeight * 0.58, Math.max(280, windowHeight - keyboardHeight - 50))
                  : windowHeight * 0.78,
            }}
            className={`w-full rounded-t-3xl border-t ${borderClass} ${modalBgClass} p-4 shadow-2xl`}>
            {/* Header */}
            <View
              className={`flex-row items-center justify-between border-b ${borderClass} pb-3.5`}>
              <View className="flex-row items-center gap-2.5">
                <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#e5005c]/30 bg-[#e5005c]/15">
                  <Image
                    source={require('../assets/DaizoChatBot.jpeg')}
                    className="h-10 w-10"
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className={`font-jetbrains text-base font-bold ${textPrimaryClass}`}>
                      Daizo
                    </Text>
                    <View className="py-0.2 rounded border border-[#22c55e]/40 bg-[#22c55e]/10 px-1.5">
                      <Text className="font-jetbrains text-[8px] font-extrabold text-[#22c55e]">
                        ONLINE
                      </Text>
                    </View>
                  </View>
                  <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
                    {dataset
                      ? `${dataset.manifestItems.length} CSV items · ${dataset.catalog.length} catalog · ${dataset.dlrRecords.length} DLR`
                      : statusMessage}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => loadAllData(true)}
                  disabled={isRefreshing || isLoadingData}
                  accessibilityLabel="Refresh Data"
                  className="h-8 w-8 items-center justify-center rounded-full bg-black/10 active:bg-black/20">
                  <RefreshCw
                    color={isRefreshing ? '#e5005c' : isDark ? '#a1a1aa' : '#71717a'}
                    size={14}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClose}
                  accessibilityLabel="Close Assistant Modal"
                  className="h-8 w-8 items-center justify-center rounded-full bg-black/10 active:bg-black/20">
                  <X color={isDark ? '#a1a1aa' : '#71717a'} size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Model Download Progress Bar */}
            {!isReady && downloadProgress > 0 && downloadProgress < 1 && (
              <View className="my-2">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                    Downloading SmolLM2 Weights (~230MB)
                  </Text>
                  <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                    {Math.round(downloadProgress * 100)}%
                  </Text>
                </View>
                <View className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                  <View
                    className="h-full rounded-full bg-[#e5005c]"
                    style={{ width: `${Math.round(downloadProgress * 100)}%` }}
                  />
                </View>
              </View>
            )}

            {/* Content Area: Loading State with daizo-no-wifi.webp vs Ready Chat State */}
            {isLoadingData ? (
              <View className="flex-1 items-center justify-center p-6">
                <View className="mb-4 overflow-hidden rounded-3xl border border-[#e5005c]/25 bg-[#e5005c]/10 p-4 shadow-lg shadow-[#e5005c]/15">
                  <SafeExpoImage
                    source={DAIZO_LOADING_ASSET}
                    style={{ width: 140, height: 140 }}
                    contentFit="contain"
                    resizeMode="contain"
                  />
                </View>
                <View className="mb-2 flex-row items-center gap-2">
                  <ActivityIndicator color="#e5005c" size="small" />
                  <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
                    {dataLoadingStatus}
                  </Text>
                </View>
                <Text
                  className={`max-w-[280px] text-center font-jetbrains text-[10px] leading-relaxed ${textSecondaryClass}`}>
                  Loading uploaded Manifest CSV (CID, TRF, SKU, UPC, QTY), Product Catalog, and
                  Item DLR records...
                </Text>
              </View>
            ) : (
              <>
                {/* Quick Suggestion Chips */}
                {messages.length <= 1 && (
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {[
                      'Ilan pa ang unscanned boxes?',
                      'Kamusta Daizo! Ano maitutulong mo?',
                      'Manifest CSV summary',
                      'Summarize Item DLR',
                      'Magkano ang SKU 300333?',
                    ].map((prompt, i) => (
                      <TouchableOpacity
                        key={i}
                        disabled={isInferencing}
                        accessibilityLabel={`Suggestion chip: ${prompt}`}
                        onPress={() => handleSend(prompt)}
                        className={`flex-row items-center gap-1.5 rounded-xl border px-3 py-2 ${cardBgClass} ${borderClass} active:opacity-70`}>
                        <Sparkles color="#e5005c" size={12} />
                        <Text className={`font-jetbrains text-xs font-medium ${textSecondaryClass}`}>
                          {prompt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Messages List */}
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  className="my-3 flex-1"
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  ListFooterComponent={
                    isInferencing ? (
                      <DaizoTypingIndicator
                        borderClass={borderClass}
                        cardBgClass={cardBgClass}
                        textSecondaryClass={textSecondaryClass}
                      />
                    ) : null
                  }
                  renderItem={({ item }) => {
                    const isUser = item.sender === 'user';
                    return (
                      <View
                        className={`my-2 flex-row ${
                          isUser ? 'justify-end' : 'items-end justify-start gap-2.5'
                        }`}>
                        {!isUser && (
                          <Image
                            source={require('../assets/DaizoChatBot.jpeg')}
                            className="mb-0.5 h-8 w-8 rounded-full border border-[#e5005c]/30"
                            resizeMode="cover"
                          />
                        )}
                        <View
                          className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                            isUser ? 'bg-[#e5005c]' : `border ${borderClass} ${cardBgClass}`
                          }`}>
                          {isUser ? (
                            <Text className="font-jetbrains text-base font-medium leading-6 text-white">
                              {item.text}
                            </Text>
                          ) : (
                            <Markdown style={markdownStyles}>{item.text}</Markdown>
                          )}
                        </View>
                      </View>
                    );
                  }}
                />

                {/* Input Bar */}
                <View className={`flex-row items-center gap-2 border-t ${borderClass} pt-3`}>
                  <TextInput
                    accessibilityLabel="Daizo Input Field"
                    testID="daizo-input"
                    editable={!isInferencing}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={() => handleSend()}
                    placeholder="Magtanong kay Daizo (presyo, box, DLR)..."
                    placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                    className={`h-12 flex-1 rounded-xl border px-4 font-jetbrains text-base ${cardBgClass} ${borderClass} ${textPrimaryClass}`}
                  />
                  <TouchableOpacity
                    accessibilityLabel="Send Message Button"
                    disabled={isInferencing || !inputText.trim()}
                    onPress={() => handleSend()}
                    activeOpacity={0.8}
                    className={`h-12 w-12 items-center justify-center rounded-xl ${
                      isInferencing || !inputText.trim()
                        ? 'bg-[#3f3f46]/40'
                        : 'bg-[#e5005c] active:bg-[#c20050]'
                    }`}>
                    {isInferencing ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Send color="#ffffff" size={18} />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
