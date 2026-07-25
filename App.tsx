import 'react-native-gesture-handler';
import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useColorScheme, LogBox } from 'react-native';
import { useMemo } from 'react';

import Navigation from './navigation';
import { AuthProvider } from './context/auth';

// Ignore the deprecated InteractionManager warning from React Native 0.85+ internals
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

export default function App() {
  const colorScheme = useColorScheme();
  const theme = useMemo(() => (colorScheme === 'dark' ? DarkTheme : DefaultTheme), [colorScheme]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigation theme={theme} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
