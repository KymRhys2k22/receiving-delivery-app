import { forwardRef } from 'react';
import { Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = forwardRef<View, ButtonProps>(
  ({ title, variant = 'primary', ...touchableProps }, ref) => {
    const variantStyle =
      variant === 'secondary'
        ? 'bg-[#1f1f22] border border-[#3f3f46] active:bg-[#2a2a2d]'
        : variant === 'danger'
          ? 'bg-[#ef4444] active:bg-[#dc2626]'
          : 'bg-[#e5005c] active:bg-[#c20050]';

    const textStyle = variant === 'secondary' ? 'text-[#fafafa]' : 'text-white';

    return (
      <TouchableOpacity
        ref={ref}
        activeOpacity={0.8}
        {...touchableProps}
        className={`items-center justify-center rounded-lg px-4 py-3 shadow-sm ${variantStyle} ${touchableProps.className || ''}`}>
        <Text className={`font-jetbrains text-sm font-bold tracking-wider ${textStyle}`}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';
