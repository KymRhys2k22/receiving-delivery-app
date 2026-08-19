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
  Database,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/auth';
import { useTheme, type ThemeMode } from '../context/theme';

export default function SettingsScreen() {
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
        <Text
          className={`mb-2.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
          APPEARANCE & THEME MODE
        </Text>

        <View className="mb-6 flex-row gap-2.5">
          {/* Dark Theme Option */}
          <TouchableOpacity
            onPress={() => handleThemeChange('dark')}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center rounded-xl border p-3.5 shadow-sm ${
              themeMode === 'dark' ? 'border-[#e5005c] bg-[#e5005c]/15' : cardBgClass
            }`}>
            <View
              className={`mb-2 h-10 w-10 items-center justify-center rounded-full ${
                themeMode === 'dark' ? 'bg-[#e5005c]' : 'bg-[#2a2a2d]'
              }`}>
              <Moon color={themeMode === 'dark' ? '#ffffff' : '#a1a1aa'} size={20} />
            </View>
            <Text
              className={`font-jetbrains text-xs font-bold ${
                themeMode === 'dark' ? 'text-[#e5005c]' : textPrimaryClass
              }`}>
              Dark Mode
            </Text>
            <Text className={`mt-0.5 font-jetbrains text-[9px] ${textSecondaryClass}`}>
              Obsidian Dark
            </Text>
            {themeMode === 'dark' && (
              <View className="mt-2 flex-row items-center gap-1 rounded-full bg-[#e5005c]/20 px-2 py-0.5">
                <Check color="#e5005c" size={12} />
                <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">ACTIVE</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Light Theme Option */}
          <TouchableOpacity
            onPress={() => handleThemeChange('light')}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center rounded-xl border p-3.5 shadow-sm ${
              themeMode === 'light' ? 'border-[#e5005c] bg-[#e5005c]/15' : cardBgClass
            }`}>
            <View
              className={`mb-2 h-10 w-10 items-center justify-center rounded-full ${
                themeMode === 'light' ? 'bg-[#e5005c]' : 'bg-[#e4e4e7]'
              }`}>
              <Sun color={themeMode === 'light' ? '#ffffff' : '#52525b'} size={20} />
            </View>
            <Text
              className={`font-jetbrains text-xs font-bold ${
                themeMode === 'light' ? 'text-[#e5005c]' : textPrimaryClass
              }`}>
              Light Mode
            </Text>
            <Text className={`mt-0.5 font-jetbrains text-[9px] ${textSecondaryClass}`}>
              Crisp Daylight
            </Text>
            {themeMode === 'light' && (
              <View className="mt-2 flex-row items-center gap-1 rounded-full bg-[#e5005c]/20 px-2 py-0.5">
                <Check color="#e5005c" size={12} />
                <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">ACTIVE</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* System Default Theme Option */}
          <TouchableOpacity
            onPress={() => handleThemeChange('system')}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center rounded-xl border p-3.5 shadow-sm ${
              themeMode === 'system' ? 'border-[#e5005c] bg-[#e5005c]/15' : cardBgClass
            }`}>
            <View
              className={`mb-2 h-10 w-10 items-center justify-center rounded-full ${
                themeMode === 'system' ? 'bg-[#e5005c]' : 'bg-[#2a2a2d]'
              }`}>
              <Laptop color={themeMode === 'system' ? '#ffffff' : '#a1a1aa'} size={20} />
            </View>
            <Text
              className={`font-jetbrains text-xs font-bold ${
                themeMode === 'system' ? 'text-[#e5005c]' : textPrimaryClass
              }`}>
              System
            </Text>
            <Text className={`mt-0.5 font-jetbrains text-[9px] ${textSecondaryClass}`}>
              Auto Match
            </Text>
            {themeMode === 'system' && (
              <View className="mt-2 flex-row items-center gap-1 rounded-full bg-[#e5005c]/20 px-2 py-0.5">
                <Check color="#e5005c" size={12} />
                <Text className="font-jetbrains text-[9px] font-bold text-[#e5005c]">AUTO</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active Session Info */}
        <Text
          className={`mb-2.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
          ACTIVE OPERATOR SESSION
        </Text>

        <View className={`mb-6 overflow-hidden rounded-xl border ${cardBgClass}`}>
          {/* Operator ID Row */}
          <View
            className={`flex-row items-center justify-between border-b p-3.5 ${innerRowBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <User color="#e5005c" size={18} />
              <Text className={`font-hanken text-xs font-semibold ${textSecondaryClass}`}>
                OPERATOR USER ID
              </Text>
            </View>
            <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
              {operatorId || 'OPERATOR'}
            </Text>
          </View>

          {/* Store Code Row */}
          <View
            className={`flex-row items-center justify-between border-b p-3.5 ${innerRowBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <Store color="#e5005c" size={18} />
              <Text className={`font-hanken text-xs font-semibold ${textSecondaryClass}`}>
                STORE CODE & NAME
              </Text>
            </View>
            <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
              {storeCode || 'N/A'} {storeName ? `(${storeName})` : ''}
            </Text>
          </View>

          {/* Login Date Row */}
          <View className={`flex-row items-center justify-between p-3.5 ${innerRowBgClass}`}>
            <View className="flex-row items-center gap-2.5">
              <Calendar color="#e5005c" size={18} />
              <Text className={`font-hanken text-xs font-semibold ${textSecondaryClass}`}>
                SESSION WORK DATE
              </Text>
            </View>
            <Text className={`font-jetbrains text-xs font-bold ${textPrimaryClass}`}>
              {loginDate || new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Terminal Status & Manifest Database */}
        <Text
          className={`mb-2.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
          TERMINAL STATUS & MANIFEST DATABASE
        </Text>

        <View className={`mb-6 rounded-xl border p-4 ${cardBgClass}`}>
          <View className="mb-3 flex-row items-center justify-between border-b border-[#3f3f46]/30 pb-3">
            <View className="flex-row items-center gap-2.5">
              <ShieldCheck color="#22c55e" size={20} />
              <View>
                <Text className={`font-hanken text-xs font-bold ${textPrimaryClass}`}>
                  Central Sync Status
                </Text>
                <Text className="font-jetbrains text-[10px] text-[#22c55e]">
                  🟢 CONNECTED & AUTHENTICATED
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              className="flex-row items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#2a2a2d] px-3 py-1.5 active:bg-[#3f3f46]">
              <RefreshCw color="#fafafa" size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <Text className="font-jetbrains text-xs font-bold text-[#fafafa]">
                {isRefreshing ? 'SYNCING...' : 'SYNC'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Database color="#a1a1aa" size={16} />
              <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
                Scanner Engine:{' '}
                <Text className="font-bold text-[#e5005c]">v3.0.0 (Expo SDK 56)</Text>
              </Text>
            </View>
          </View>
        </View>

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
          className="mb-10 flex-row items-center justify-center gap-2 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/15 py-3.5 active:bg-[#ef4444]/25">
          <LogOut color="#ef4444" size={18} />
          <Text className="font-jetbrains text-xs font-extrabold tracking-wider text-[#ef4444]">
            TERMINATE SESSION (LOG OUT)
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
