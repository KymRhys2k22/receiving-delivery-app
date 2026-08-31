import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { AlertTriangle, Key } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/theme';
import storeData from '../store.json';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { isDark } = useTheme();

  // Timezone-safe date string format YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [operatorId, setOperatorId] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [workDate] = useState(getTodayDateString());
  const [error, setError] = useState<string | null>(null);

  const [focusedField, setFocusedField] = useState<'operator' | 'store' | 'date' | null>(null);

  const handleLogin = () => {
    setError(null);
    const cleanOpName = operatorId.trim().toUpperCase();
    const cleanStoreCode = storeCode.trim();

    if (!cleanOpName) {
      setError('Operator Name is required.');
      return;
    }
    if (!cleanStoreCode) {
      setError('Store Code is required.');
      return;
    }
    if (!workDate.trim()) {
      setError('Work Date is required.');
      return;
    }

    // Validate Store Code against store.json
    const storeNum = parseInt(cleanStoreCode, 10);
    const matchedStore = storeData.find(
      (s) => s.store === storeNum || String(s.store) === cleanStoreCode
    );

    if (!matchedStore) {
      setError(
        `INVALID STORE CODE: Store "${cleanStoreCode}" does not exist in the official store directory.`
      );
      return;
    }

    // Store is valid! Sign in with operator name, store code, store name, and date
    signIn(cleanOpName, cleanStoreCode, matchedStore.name, workDate.trim());
  };

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const cardBgClass = isDark ? 'bg-[#1b1b1e] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const inputBgClass = isDark ? 'bg-[#131316] text-[#fafafa]' : 'bg-[#fafafa] text-[#18181b]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${bgClass}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className={`flex-1 ${bgClass} px-4 pb-40`}
        keyboardShouldPersistTaps="handled">
        {/* Terminal Header */}
        <View className="mb-8 items-center">
          <View className="mb-4 items-center justify-center">
            <Image source={require('../assets/daisologo.png')} className="h-60 w-60" />
          </View>
          <Text className={`font-hanken text-2xl font-bold tracking-tight ${textPrimaryClass}`}>
            Scanner Terminal
          </Text>
          <Text
            className={`mt-1.5 max-w-[280px] text-center font-hanken text-sm ${textSecondaryClass}`}>
            Log in with your Operator ID and Store Code to begin verifying deliveries.
          </Text>
        </View>

        {/* Form Container */}
        <View className={`rounded-lg border p-5 shadow-lg ${cardBgClass}`}>
          {/* Operator ID Field */}
          <View className="mb-4">
            <Text
              className={`mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
              OPERATOR NAME
            </Text>
            <TextInput
              value={operatorId}
              onChangeText={setOperatorId}
              placeholder="JUAN DELA CRUZ"
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              autoCapitalize="characters"
              onFocus={() => setFocusedField('operator')}
              onBlur={() => setFocusedField(null)}
              className={`h-11 rounded-lg border px-3 font-jetbrains text-sm ${inputBgClass} ${
                focusedField === 'operator'
                  ? 'border-[#e5005c]'
                  : isDark
                    ? 'border-[#3f3f46]'
                    : 'border-[#d4d4d8]'
              }`}
            />
          </View>

          {/* Store Code Field */}
          <View className="mb-4 mt-2">
            <Text
              className={`mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
              Store Code
            </Text>
            <TextInput
              maxLength={3}
              keyboardType="number-pad"
              value={storeCode}
              onChangeText={setStoreCode}
              placeholder="e.g. 202"
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              onFocus={() => setFocusedField('store')}
              onBlur={() => setFocusedField(null)}
              className={`h-11 rounded-lg border px-3 font-jetbrains text-sm ${inputBgClass} ${
                focusedField === 'store'
                  ? 'border-[#e5005c]'
                  : isDark
                    ? 'border-[#3f3f46]'
                    : 'border-[#d4d4d8]'
              }`}
            />
          </View>

          {/* Work Date Field */}
          <View className="mb-5">
            <Text
              className={`mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
              Work Date
            </Text>
            <TextInput
              editable={false}
              selectTextOnFocus={false}
              value={workDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              onFocus={() => setFocusedField('date')}
              onBlur={() => setFocusedField(null)}
              className={`h-11 rounded-lg border px-3 font-jetbrains text-sm ${inputBgClass} ${
                focusedField === 'date'
                  ? 'border-[#e5005c]'
                  : isDark
                    ? 'border-[#3f3f46]'
                    : 'border-[#d4d4d8]'
              }`}
            />
          </View>

          {/* Error Message Banner */}
          {error && (
            <View className="mb-4 flex-row items-center gap-2 rounded border border-[#ffb4ab] bg-[#ffb4ab]/10 p-3">
              <AlertTriangle color="#ffb4ab" size={16} />
              <Text className="flex-1 font-hanken text-xs font-semibold text-[#ffb4ab]">
                {error}
              </Text>
            </View>
          )}

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.8}
            className="h-12 flex-row items-center justify-center gap-2 rounded-lg bg-[#e5005c] py-3 active:bg-[#c20050]">
            <Key color="#ffffff" size={16} />
            <Text className="font-jetbrains text-sm font-bold text-[#ffffff]">
              AUTHENTICATE TERMINAL
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer/System Info */}
        <View className="mt-8 items-center">
          <Text
            className={`font-jetbrains text-[9px] uppercase tracking-wider ${textSecondaryClass}`}>
            System v5.0.0 • Connected to Manifest Server
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
