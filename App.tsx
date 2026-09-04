import 'react-native-gesture-handler';
import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { LogBox } from 'react-native';
import { useMemo, useEffect } from 'react';

import Navigation from './navigation';
import { AuthProvider } from './context/auth';
import { ThemeProvider, useTheme } from './context/theme';
import { AiAssistantProvider } from './context/aiAssistant';
import { initAppUpdateChecker } from './services/appUpdateService';

// Ignore the deprecated InteractionManager warning from React Native 0.85+ internals
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

function AppContent() {
  const { isDark } = useTheme();
  const theme = useMemo(() => (isDark ? DarkTheme : DefaultTheme), [isDark]);

  useEffect(() => {
    const cleanup = initAppUpdateChecker();
    return () => {
      cleanup();
    };
  }, []);

  return (
    <AuthProvider>
      <AiAssistantProvider>
        <Navigation theme={theme} />
      </AiAssistantProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
