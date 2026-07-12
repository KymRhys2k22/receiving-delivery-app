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
} from 'react-native';
import { Scan, AlertTriangle, Key } from 'lucide-react-native';
import { useAuth } from '../context/auth';

export default function LoginScreen() {
  const { signIn } = useAuth();

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
  const [workDate, setWorkDate] = useState(getTodayDateString());
  const [error, setError] = useState<string | null>(null);

  const [focusedField, setFocusedField] = useState<'operator' | 'store' | 'date' | null>(null);

  const handleLogin = () => {
    setError(null);
    if (!operatorId.trim()) {
      setError('Operator ID is required.');
      return;
    }
    if (!storeCode.trim()) {
      setError('Store Code is required.');
      return;
    }
    if (!workDate.trim()) {
      setError('Work Date is required.');
      return;
    }
    signIn(operatorId.trim().toUpperCase(), storeCode.trim().toUpperCase(), workDate.trim());
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#131316]">
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="flex-1 bg-[#131316] px-4"
        keyboardShouldPersistTaps="handled">
        {/* Terminal Header */}
        <View className="mb-8 items-center">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#1f1f22]">
            <Scan color="#e5005c" size={28} />
          </View>
          <Text className="font-hanken text-2xl font-bold tracking-tight text-[#fafafa]">
            Scanner Terminal
          </Text>
          <Text className="mt-1.5 max-w-[280px] text-center font-hanken text-sm text-[#a1a1aa]">
            Log in with your Operator ID and Store Code to begin verifying deliveries.
          </Text>
        </View>

        {/* Form Container */}
        <View className="rounded-lg border border-[#3f3f46] bg-[#1b1b1e] p-5 shadow-lg">
          {/* Operator ID Field */}
          <View className="mb-4">
            <Text className="mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              OPERATOR NAME
            </Text>
            <TextInput
              value={operatorId}
              onChangeText={setOperatorId}
              placeholder="JUAN DELA CRUZ"
              placeholderTextColor="#71717a"
              autoCapitalize="characters"
              onFocus={() => setFocusedField('operator')}
              onBlur={() => setFocusedField(null)}
              className={`h-11 rounded-lg border bg-[#131316] px-3 font-jetbrains text-sm text-[#fafafa] ${
                focusedField === 'operator' ? 'border-[#e5005c]' : 'border-[#3f3f46]'
              }`}
            />
          </View>

          {/* Store Code Field */}
          <View className="mb-4">
            <Text className="mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              Store Code
            </Text>
            <TextInput
              maxLength={3}
              keyboardType="number-pad"
              value={storeCode}
              onChangeText={setStoreCode}
              placeholder="e.g. 202"
              placeholderTextColor="#71717a"
              onFocus={() => setFocusedField('store')}
              onBlur={() => setFocusedField(null)}
              className={`h-11 rounded-lg border bg-[#131316] px-3 font-jetbrains text-sm text-[#fafafa] ${
                focusedField === 'store' ? 'border-[#e5005c]' : 'border-[#3f3f46]'
              }`}
            />
          </View>

          {/* Work Date Field */}
          <View className="mb-5">
            <Text className="mb-2 font-jetbrains text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              Work Date
            </Text>
            <TextInput
              editable={false}
              selectTextOnFocus={false}
              value={workDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#71717a"
              onFocus={() => setFocusedField('date')}
              onBlur={() => setFocusedField(null)}
              className={`h-11 rounded-lg border bg-[#131316] px-3 font-jetbrains text-sm text-[#fafafa] ${
                focusedField === 'date' ? 'border-[#e5005c]' : 'border-[#3f3f46]'
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
          <Text className="font-jetbrains text-[9px] uppercase tracking-wider text-[#71717a]">
            System v1.0.0 • Connected to Manifest Server
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
