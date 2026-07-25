import React from 'react';
import { Text, View, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { LogOut, Info } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { operatorId, storeCode, loginDate, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-[#131316]">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#3f3f46] bg-[#131316] px-4 py-4">
        <Text className="font-hanken text-xl font-bold text-[#fafafa]">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Active Session Info */}
        <Text className="mb-2.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
          Active Session
        </Text>

        <View className="mb-6 overflow-hidden rounded-lg border border-[#3f3f46] bg-[#1b1b1e]">
          {/* Operator ID Row */}
          <View className="h-12 flex-row items-center justify-between border-b border-[#3f3f46] bg-[#1b1b1e] px-4">
            <Text className="font-hanken text-sm text-[#a1a1aa]">Operator ID</Text>
            <Text className="font-jetbrains text-sm font-semibold text-[#fafafa]">
              {operatorId}
            </Text>
          </View>

          {/* Store Code Row */}
          <View className="h-12 flex-row items-center justify-between border-b border-[#3f3f46] bg-[#1b1b1e] px-4">
            <Text className="font-hanken text-sm text-[#a1a1aa]">Store Code</Text>
            <Text className="font-jetbrains text-sm font-semibold text-[#fafafa]">{storeCode}</Text>
          </View>

          {/* Login Date Row */}
          <View className="h-12 flex-row items-center justify-between bg-[#1b1b1e] px-4">
            <Text className="font-hanken text-sm text-[#a1a1aa]">Work Date</Text>
            <Text className="font-jetbrains text-sm font-semibold text-[#fafafa]">{loginDate}</Text>
          </View>
        </View>

        {/* System Info */}
        <Text className="mb-2.5 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
          Terminal Status
        </Text>
        <View className="mb-6 rounded-lg border border-[#3f3f46] bg-[#1b1b1e] p-4">
          <View className="flex-row items-start gap-3">
            <Info color="#e5005c" size={18} className="mt-0.5" />
            <View className="flex-1">
              <Text className="font-hanken text-xs font-semibold text-[#fafafa]">
                Connected to Server
              </Text>
              <Text className="mt-1 font-hanken text-[11px] text-[#a1a1aa]">
                This scanner is authenticated and synced with the central manifest database.
              </Text>
            </View>
          </View>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          onPress={signOut}
          activeOpacity={0.8}
          className="mb-8 h-12 flex-row items-center justify-center gap-2 rounded-lg border border-[#ffb4ab]/30 bg-[#1f1f22] py-3 active:bg-[#2a2a2d]">
          <LogOut color="#ffb4ab" size={16} />
          <Text className="font-jetbrains text-sm font-semibold text-[#ffb4ab]">
            TERMINATE SESSION (LOG OUT)
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
