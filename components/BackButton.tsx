import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

interface BackButtonProps {
  onPress: () => void;
  title?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, title = 'Back' }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-1 rounded-lg border border-[#3f3f46]/60 bg-[#1f1f22] px-2.5 py-1.5 active:bg-[#2a2a2d]">
      <ChevronLeft size={16} color="#e5005c" />
      <Text className="font-jetbrains text-xs font-bold text-[#fafafa]">{title}</Text>
    </TouchableOpacity>
  );
};
