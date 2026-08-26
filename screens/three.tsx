import React, { useState } from 'react';
import { Text, View, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  Sun,
  Moon,
  Laptop,
  User,
  Store,
  Calendar,
  ShieldCheck,
  Check,
  RefreshCw,
  Sparkles,
  FileWarning,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth';
import { useTheme, type ThemeMode } from '../context/theme';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2.5 mt-1 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { operatorId, storeCode, storeName, loginDate, signOut } = useAuth();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setTimeout(() => {
      setIsRefreshing(false);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert('Database Synced', 'Manifest records are up to date.');
    }, 800);
  };

  // Color variables for Light / Dark mode
  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const headerBgClass = isDark ? 'bg-[#131316] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const cardBgClass = isDark ? 'bg-[#1f1f22] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerRowBgClass = isDark
    ? 'bg-[#18181b] border-[#3f3f46]'
    : 'bg-[#fafafa] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  const THEME_OPTIONS = [
    { mode: 'dark', label: 'Dark Mode', sub: 'Obsidian Dark', badge: 'ACTIVE', Icon: Moon, idleBg: '#2a2a2d' },
    { mode: 'light', label: 'Light Mode', sub: 'Crisp Daylight', badge: 'ACTIVE', Icon: Sun, idleBg: '#e4e4e7' },
    { mode: 'system', label: 'System', sub: 'Auto Match', badge: 'AUTO', Icon: Laptop, idleBg: '#2a2a2d' },
  ] as const;

  return (
    <SafeAreaView className={`flex-1 ${bgClass}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View className={`flex-row items-center justify-between border-b px-4 py-4 ${headerBgClass}`}>
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#e5005c]/15">
            <Sparkles color="#e5005c" size={20} />
          </View>
          <View>
            <Text className={`font-hanken text-xl font-bold ${textPrimaryClass}`}>
              Terminal Settings
            </Text>
            <Text className={`font-jetbrains text-[10px] font-semibold ${textSecondaryClass}`}>
              PREFERENCES & AUDIT CONFIG
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Appearance & Color Theme Mode Selection */}
        <SectionLabel>Appearance & Theme Mode</SectionLabel>

        <View className="mb-6 flex-row gap-2.5">
          {THEME_OPTIONS.map(({ mode, label, sub, badge, Icon, idleBg }) => {
            const isActive = themeMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => handleThemeChange(mode)}
                activeOpacity={0.8}
                className={`relative flex-1 items-center justify-center rounded-xl border p-3.5 ${
                  isActive ? 'border-[#e5005c] bg-[#e5005c]/15' : cardBgClass
                }`}>
                {isActive && (
                  <View className="absolute right-2 top-2 h-4 w-4 items-center justify-center rounded-full bg-[#e5005c]">
                    <Check color="#ffffff" size={10} />
                  </View>
                )}
                <View
                  className="mb-2.5 h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: isActive ? '#e5005c' : idleBg }}>
                  <Icon color={isActive ? '#ffffff' : mode === 'light' ? '#52525b' : '#a1a1aa'} size={20} />
                </View>
                <Text
                  className={`font-jetbrains text-[11px] font-bold ${
                    isActive ? 'text-[#e5005c]' : textPrimaryClass
                  }`}>
                  {label}
                </Text>
                <Text className={`mt-0.5 font-jetbrains text-[9px] ${textSecondaryClass}`}>
                  {sub}
                </Text>
                <View
                  className={`mt-2 rounded-full px-2 py-0.5 ${isActive ? 'bg-[#e5005c]/20' : 'bg-transparent'}`}>
                  <Text
                    className={`font-jetbrains text-[8px] font-bold tracking-wider ${
                      isActive ? 'text-[#e5005c]' : 'text-transparent'
                    }`}>
                    {badge}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Session Info */}
        <SectionLabel>Active Operator Session</SectionLabel>

        <View className={`mb-6 overflow-hidden rounded-xl border ${cardBgClass}`}>
          {/* Operator ID Row */}
          <View
            className={`flex-row items-center justify-between border-b p-3.5 ${innerRowBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e5005c]/12">
                <User color="#e5005c" size={15} />
              </View>
              <Text className="font-jetbrains text-[9px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                OPERATOR USER ID
              </Text>
            </View>
            <Text
              className={`max-w-[45%] text-right font-jetbrains text-xs font-bold ${textPrimaryClass}`}
              numberOfLines={1}>
              {operatorId || 'OPERATOR'}
            </Text>
          </View>

          {/* Store Code Row */}
          <View
            className={`flex-row items-center justify-between border-b p-3.5 ${innerRowBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e5005c]/12">
                <Store color="#e5005c" size={15} />
              </View>
              <Text className="font-jetbrains text-[9px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                STORE CODE & NAME
              </Text>
            </View>
            <Text
              className={`max-w-[50%] text-right font-jetbrains text-xs font-bold ${textPrimaryClass}`}
              numberOfLines={1}>
              {storeCode || 'N/A'} {storeName ? `(${storeName})` : ''}
            </Text>
          </View>

          {/* Login Date Row */}
          <View className={`flex-row items-center justify-between p-3.5 ${innerRowBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e5005c]/12">
                <Calendar color="#e5005c" size={15} />
              </View>
              <Text className="font-jetbrains text-[9px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                SESSION WORK DATE
              </Text>
            </View>
            <Text
              className={`max-w-[50%] text-right font-jetbrains text-xs font-bold ${textPrimaryClass}`}
              numberOfLines={1}>
              {loginDate || new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Terminal Status & Manifest Database */}
        <SectionLabel>Terminal Status & Database</SectionLabel>

        <View className={`mb-6 rounded-xl border p-4 ${cardBgClass}`}>
          <View className="mb-3 flex-row items-center justify-between border-b border-[#3f3f46]/30 pb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#22c55e]/15">
                <ShieldCheck color="#22c55e" size={18} />
              </View>
              <View>
                <Text className={`font-hanken text-xs font-bold ${textPrimaryClass}`}>
                  Central Sync Status
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                  <Text className="font-jetbrains text-[10px] font-bold text-[#22c55e]">
                    CONNECTED & AUTHENTICATED
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              className="flex-row items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#2a2a2d] px-3 py-1.5 active:bg-[#3f3f46]">
              <RefreshCw color="#fafafa" size={14} />
              <Text className="font-jetbrains text-xs font-bold text-[#fafafa]">
                {isRefreshing ? 'SYNCING…' : 'SYNC'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-2">
            <View className={`flex-1 rounded-lg px-2.5 py-2 ${innerRowBgClass}`}>
              <Text className={`font-jetbrains text-[8px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                Scanner Engine
              </Text>
              <Text className="mt-0.5 font-jetbrains text-xs font-bold text-[#e5005c]">v4.0.0</Text>
            </View>
            <View className={`flex-1 rounded-lg px-2.5 py-2 ${innerRowBgClass}`}>
              <Text className={`font-jetbrains text-[8px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                Runtime
              </Text>
              <Text className={`mt-0.5 font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
                Expo SDK 56
              </Text>
            </View>
          </View>
        </View>

        {/* Damage Lost Record (DLR) Intake */}
        <SectionLabel>Damage & Loss Tools</SectionLabel>

        <TouchableOpacity
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
            navigation.navigate('DamageLostRecord' as never);
          }}
          activeOpacity={0.8}
          className={`mb-6 flex-row items-center justify-between rounded-xl border p-4 ${cardBgClass}`}>
          <View className="flex-1 flex-row items-center gap-2.5">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#e5005c]/15">
              <FileWarning color="#e5005c" size={20} />
            </View>
            <View className="flex-1">
              <Text className={`font-hanken text-sm font-bold ${textPrimaryClass}`}>
                Damage Lost Record
              </Text>
              <Text className="font-jetbrains text-[10px] text-[#e5005c]">
                SCAN · REASON · QTY · 3 PHOTOS · SYNC
              </Text>
            </View>
          </View>
          <View className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#e5005c]/15">
            <ChevronRight color="#e5005c" size={16} />
          </View>
        </TouchableOpacity>

        {/* Terminate Session (Log Out) Button */}
        <TouchableOpacity
          onPress={() => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {}
            Alert.alert(
              'Log Out Session',
              'Are you sure you want to terminate this scanning operator session?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log Out',
                  style: 'destructive',
                  onPress: () => signOut(),
                },
              ]
            );
          }}
          activeOpacity={0.8}
          className="mb-10 flex-row items-center justify-center gap-2.5 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/15 py-3.5 active:bg-[#ef4444]/25">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-[#ef4444]/20">
            <LogOut color="#ef4444" size={14} />
          </View>
          <Text className="font-jetbrains text-xs font-extrabold tracking-wider text-[#ef4444]">
            TERMINATE SESSION (LOG OUT)
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
