import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2, Store, User, Calendar, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/theme';

export default function OnBoardingGreetScreen() {
  const navigation = useNavigation();
  const { operatorId, storeCode, storeName, loginDate } = useAuth();
  const { isDark } = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(3);

  const goToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'TabNavigator' as never }],
    });
  };

  // Prevent back button gesture on Android during onboarding greet
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Disable back button action
    });
    return () => backSubscription.remove();
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      goToDashboard();
    }
  }, [secondsLeft]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleProceed = () => {
    goToDashboard();
  };

  const bgClass = isDark ? 'bg-[#131316]' : 'bg-[#f4f4f5]';
  const cardBgClass = isDark ? 'bg-[#1b1b1e] border-[#3f3f46]' : 'bg-[#ffffff] border-[#e4e4e7]';
  const innerCardBgClass = isDark
    ? 'bg-[#131316] border-[#3f3f46]/60'
    : 'bg-[#fafafa] border-[#e4e4e7]';
  const textPrimaryClass = isDark ? 'text-[#fafafa]' : 'text-[#18181b]';
  const textSecondaryClass = isDark ? 'text-[#a1a1aa]' : 'text-[#71717a]';

  return (
    <SafeAreaView className={`flex-1 ${bgClass}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View className="flex-1 justify-between px-6 py-8">
        {/* Top Header / Logo */}
        <View className="mt-4 items-center">
          <View className="mb-2 items-center justify-center">
            <Image source={require('../assets/daisologo.png')} className="h-28 w-28" />
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-3.5 py-1">
            <CheckCircle2 color="#22c55e" size={14} />
            <Text className="font-jetbrains text-[10px] font-extrabold tracking-wider text-[#22c55e]">
              TERMINAL AUTHENTICATED
            </Text>
          </View>
        </View>

        {/* Main Greeting Card */}
        <View className={`rounded-2xl border p-6 shadow-2xl ${cardBgClass}`}>
          {/* Welcome Headline */}
          <View className="mb-6 items-center">
            <Text className="font-jetbrains text-xs font-bold uppercase tracking-widest text-[#e5005c]">
              WELCOME OPERATOR
            </Text>
            <Text
              className={`mt-1 text-center font-hanken text-2xl font-extrabold ${textPrimaryClass}`}>
              {operatorId || 'OPERATOR'}
            </Text>
          </View>

          {/* Store & Session Details Box */}
          <View className={`gap-3 rounded-xl border p-4 ${innerCardBgClass}`}>
            {/* Store Name & Code */}
            <View className="flex-row items-start gap-3 border-b border-[#3f3f46]/30 pb-3">
              <View className="rounded-lg bg-[#e5005c]/10 p-2.5">
                <Store color="#e5005c" size={20} />
              </View>
              <View className="flex-1">
                <Text
                  className={`font-jetbrains text-[10px] font-bold uppercase tracking-wider ${textSecondaryClass}`}>
                  ASSIGNED STORE
                </Text>
                <Text
                  className={`mt-0.5 font-hanken text-base font-bold ${textPrimaryClass}`}
                  numberOfLines={2}>
                  {storeName || 'Daiso Japan Store'}
                </Text>
                <View
                  className={`mt-1 self-start rounded px-2 py-0.5 ${isDark ? 'bg-[#2a2a2d]' : 'bg-[#e4e4e7]'}`}>
                  <Text className="font-jetbrains text-[10px] font-bold text-[#e5005c]">
                    CODE: {storeCode || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Operator & Work Date Details */}
            <View className="flex-row items-center justify-between pt-1">
              <View className="flex-row items-center gap-2">
                <User color={isDark ? '#a1a1aa' : '#71717a'} size={14} />
                <Text className={`font-jetbrains text-xs ${textPrimaryClass}`}>{operatorId}</Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Calendar color={isDark ? '#a1a1aa' : '#71717a'} size={14} />
                <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>{loginDate}</Text>
              </View>
            </View>
          </View>

          {/* Live Redirect Timer Banner */}
          <View className="mt-6 items-center">
            <View className="mb-2 h-14 w-14 items-center justify-center rounded-full border-2 border-[#e5005c] bg-[#e5005c]/10">
              <Text className="font-jetbrains text-2xl font-black text-[#e5005c]">
                {secondsLeft}
              </Text>
            </View>
            <Text className={`font-jetbrains text-xs ${textSecondaryClass}`}>
              Redirecting to Receiving Dashboard in{' '}
              <Text className={`font-bold ${textPrimaryClass}`}>{secondsLeft}s</Text>...
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleProceed}
          activeOpacity={0.8}
          className="h-13 flex-row items-center justify-center gap-2 rounded-xl bg-[#e5005c] py-3.5 shadow-lg active:bg-[#c20050]">
          <Text className="font-jetbrains text-sm font-extrabold tracking-wider text-[#ffffff]">
            PROCEED TO DASHBOARD
          </Text>
          <ArrowRight color="#ffffff" size={18} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
