import React, { useState, useCallback, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import {
  Box as BoxIcon,
  Package,
  Calendar,
  Clock,
  Trash2,
  Play,
  CheckCircle2,
  FileText,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/theme';
import {
  MANIFEST_CIDS_KEY,
  SCANNED_CIDS_KEY,
  MANIFEST_ITEMS_KEY,
  SCANNED_ITEMS_KEY,
  SCAN_HISTORY_KEY,
  type ItemManifestRecord,
  type HistorySessionRecord,
  saveSessionToHistory,
} from '../utils/storage';

export { SCAN_HISTORY_KEY, type HistorySessionRecord, saveSessionToHistory };

export default function HistoryScreen({ navigation: propNavigation }: { navigation?: any } = {}) {
  const contextNavigation = useContext(NavigationContext);
  const navigation = propNavigation || contextNavigation;
  const { isDark } = useTheme();
  const [history, setHistory] = useState<HistorySessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerCardBgClass = isDark
    ? 'bg-[#131316] border-[#2a2a2d]'
    : 'bg-[#fafafa] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedHistory = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /** Resume a historical session */
  const handleResumeSession = async (record: HistorySessionRecord) => {
    try {
      if (record.type === 'box') {
        const manifestCids: string[] = record.manifestData || [];
        const scannedCids: string[] = record.scannedData || [];

        await AsyncStorage.setItem(MANIFEST_CIDS_KEY, JSON.stringify(manifestCids));
        await AsyncStorage.setItem(SCANNED_CIDS_KEY, JSON.stringify(scannedCids));

        showToast(`Loaded Box Session: ${record.fileName}`);
        navigation.navigate('ScanningBox' as never);
      } else {
        const manifestItems: ItemManifestRecord[] = record.manifestData || [];
        const scannedMap: Record<string, number> = record.scannedData || {};

        await AsyncStorage.setItem(MANIFEST_ITEMS_KEY, JSON.stringify(manifestItems));
        await AsyncStorage.setItem(SCANNED_ITEMS_KEY, JSON.stringify(scannedMap));

        showToast(`Loaded Item Session: ${record.fileName}`);
        navigation.navigate('ScanningItem' as never);
      }
    } catch {
      showToast('Failed to resume session');
    }
  };

  /** Delete single session */
  const handleDeleteSession = (id: string) => {
    Alert.alert('Delete Session', 'Are you sure you want to remove this session from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = history.filter((h) => h.id !== id);
          setHistory(updated);
          await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
          showToast('Session deleted');
        },
      },
    ]);
  };

  /** Clear all history */
  const handleClearAllHistory = () => {
    if (history.length === 0) return;
    Alert.alert(
      'Clear All History',
      'This will remove all historical CSV session records. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setHistory([]);
            await AsyncStorage.removeItem(SCAN_HISTORY_KEY);
            showToast('All history cleared');
          },
        },
      ]
    );
  };

  // Group history by date
  const groupedByDate: Record<string, HistorySessionRecord[]> = {};
  history.forEach((record) => {
    const d = record.date || 'Unknown Date';
    if (!groupedByDate[d]) {
      groupedByDate[d] = [];
    }
    groupedByDate[d].push(record);
  });

  const dateKeys = Object.keys(groupedByDate).sort((a, b) => (a < b ? 1 : -1));

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const formatDateHeader = (dateStr: string) => {
    if (dateStr === todayStr) return 'TODAY — ' + dateStr;
    if (dateStr === yesterdayStr) return 'YESTERDAY — ' + dateStr;
    return dateStr;
  };

  return (
    <SafeAreaView className={`flex-1 ${bgClass}`}>
      {/* Toast Banner */}
      {toastMessage && (
        <View className="absolute left-4 right-4 top-14 z-50 flex-row items-center gap-2 rounded-xl border border-[#22c55e] bg-[#163e26] p-3 shadow-xl">
          <CheckCircle2 color="#22c55e" size={18} />
          <Text className="flex-1 font-jetbrains text-xs font-bold text-[#4ade80]">
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Screen Header */}
      <View className={`flex-row items-center justify-between border-b px-5 py-4 ${headerBgClass}`}>
        <View>
          <Text className={`font-hanken text-2xl font-extrabold ${textPrimaryClass}`}>
            Scanning History
          </Text>
          <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
            Archived CSV Sessions by Date
          </Text>
        </View>

        {history.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAllHistory}
            className="flex-row items-center gap-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-1.5">
            <Trash2 color="#ef4444" size={14} />
            <Text className="font-jetbrains text-xs font-bold text-[#ef4444]">CLEAR ALL</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View className="items-center justify-center gap-2 py-20">
            <ActivityIndicator color="#ff80ab" size="small" />
            <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
              Loading history...
            </Text>
          </View>
        ) : history.length === 0 ? (
          <View className="items-center justify-center px-6 py-16">
            <View className={`mb-4 rounded-2xl border p-6 ${cardBgClass}`}>
              <FileText color={isDark ? '#71717a' : '#a1a1aa'} size={40} className="self-center" />
            </View>
            <Text className={`mb-1 text-center font-hanken text-lg font-bold ${textPrimaryClass}`}>
              No History Records Yet
            </Text>
            <Text className={`mb-6 text-center font-jetbrains text-xs ${textSecondaryClass}`}>
              When you upload CSV manifests in the Upload screen, your sessions will automatically
              be stored here by date for quick resuming.
            </Text>
          </View>
        ) : (
          dateKeys.map((dateKey) => {
            const records = groupedByDate[dateKey];

            return (
              <View key={dateKey} className="mb-6">
                {/* Date Header */}
                <View className="mb-3 flex-row items-center gap-2 border-b border-[#3f3f46]/30 pb-2">
                  <Calendar color="#ff80ab" size={16} />
                  <Text className="font-jetbrains text-xs font-extrabold uppercase tracking-wider text-[#ff80ab]">
                    {formatDateHeader(dateKey)}
                  </Text>

                  <View className={`ml-auto rounded px-2 py-0.5 ${innerCardBgClass}`}>
                    <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                      {records.length} {records.length === 1 ? 'Session' : 'Sessions'}
                    </Text>
                  </View>
                </View>

                {/* Session Cards under this Date */}
                {records.map((record) => {
                  const isBox = record.type === 'box';
                  const total = record.totalCount || 1;
                  const scanned = record.scannedCount || 0;
                  const pct = Math.min(100, Math.round((scanned / total) * 100));

                  return (
                    <View
                      key={record.id}
                      className={`mb-3.5 rounded-xl border p-4 shadow-md ${cardBgClass}`}>
                      {/* Top Header: Badge, Timestamp, & Delete */}
                      <View className="mb-2 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <View
                            className={`flex-row items-center gap-1 rounded px-2 py-0.5 ${
                              isBox ? 'bg-[#ff80ab]/20' : 'bg-[#e5005c]/20'
                            }`}>
                            {isBox ? (
                              <BoxIcon color="#ff80ab" size={12} />
                            ) : (
                              <Package color="#e5005c" size={12} />
                            )}
                            <Text
                              className={`font-jetbrains text-[10px] font-extrabold ${
                                isBox ? 'text-[#ff80ab]' : 'text-[#e5005c]'
                              }`}>
                              {isBox ? 'BOX MANIFEST' : 'ITEM MANIFEST'}
                            </Text>
                          </View>

                          <View className="flex-row items-center gap-1">
                            <Clock color={isDark ? '#71717a' : '#a1a1aa'} size={11} />
                            <Text className={`font-jetbrains text-[10px] ${textSecondaryClass}`}>
                              {record.timestamp}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteSession(record.id)}
                          className="p-1">
                          <Trash2 color={isDark ? '#71717a' : '#a1a1aa'} size={15} />
                        </TouchableOpacity>
                      </View>

                      {/* File Name */}
                      <Text
                        className={`mb-3 font-hanken text-sm font-bold ${textPrimaryClass}`}
                        numberOfLines={1}>
                        📄 {record.fileName || 'Manifest Data'}
                      </Text>

                      {/* Progress Metrics */}
                      <View className={`mb-3.5 rounded-lg border p-3 ${innerCardBgClass}`}>
                        <View className="mb-1.5 flex-row items-center justify-between">
                          <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
                            Progress:{' '}
                            <Text className={`font-bold ${textPrimaryClass}`}>
                              {scanned} / {total}
                            </Text>{' '}
                            {isBox ? 'Boxes' : 'Qty'}
                          </Text>
                          <Text
                            className={`font-jetbrains text-xs font-bold ${
                              pct === 100
                                ? 'text-[#22c55e]'
                                : isBox
                                  ? 'text-[#ff80ab]'
                                  : 'text-[#e5005c]'
                            }`}>
                            {pct}%
                          </Text>
                        </View>

                        <View className="h-1.5 w-full overflow-hidden rounded-full bg-[#353438]">
                          <View
                            className={`h-full rounded-full ${
                              pct === 100 ? 'bg-[#22c55e]' : isBox ? 'bg-[#ff80ab]' : 'bg-[#e5005c]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </View>
                      </View>

                      {/* Resume Scanning Button */}
                      <TouchableOpacity
                        onPress={() => handleResumeSession(record)}
                        activeOpacity={0.8}
                        className={`flex-row items-center justify-center gap-2 rounded-lg py-2.5 shadow ${
                          isBox ? 'bg-[#ff80ab]' : 'bg-[#e5005c]'
                        }`}>
                        <Play
                          color={isBox ? '#131316' : '#ffffff'}
                          size={15}
                          fill={isBox ? '#131316' : '#ffffff'}
                        />
                        <Text
                          className={`font-jetbrains text-xs font-extrabold tracking-wider ${
                            isBox ? 'text-[#131316]' : 'text-[#ffffff]'
                          }`}>
                          RESUME SCANNING
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
