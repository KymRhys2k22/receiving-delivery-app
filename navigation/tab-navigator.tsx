import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogIn, History, Settings, FileWarning, Bot } from 'lucide-react-native';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import One from '../screens/one';
import Three from '../screens/three';
import Two from '../screens/two';
import DamageLostRecordScreen from '../screens/damageLostRecord';
import { useTheme } from '../context/theme';
import { useAiAssistant } from '../context/aiAssistant';

function DamageLostRecordTab(props: any) {
  return <DamageLostRecordScreen {...props} embedded />;
}

function EmptyScreen() {
  return null;
}

function TabBarIcon({
  focused,
  icon: Icon,
  label,
}: {
  focused: boolean;
  icon: any;
  label: string;
}) {
  const { isDark } = useTheme();
  const activeBg = isDark ? '#e5005c26' : '#e5005c1a';
  const activeTextColor = '#e5005c';
  const inactiveTextColor = isDark ? '#a1a1aa' : '#71717a';

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? activeBg : 'transparent',
        borderRadius: 10,
        width: 62,
        height: 48,
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? '#e5005c55' : 'transparent',
      }}>
      <Icon color={focused ? activeTextColor : inactiveTextColor} size={18} />
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'JetBrains Mono',
          fontWeight: focused ? '700' : '500',
          color: focused ? activeTextColor : inactiveTextColor,
          marginTop: 3,
          letterSpacing: 0.2,
        }}>
        {label}
      </Text>
    </View>
  );
}

function CenterAiTabButton() {
  const { openAssistant } = useAiAssistant();
  const { isDark } = useTheme();

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    openAssistant();
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityLabel="Daizo"
        accessibilityRole="button"
        style={{
          top: -14,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: '#e5005c',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3.5,
          borderColor: isDark ? '#131316' : '#ffffff',
          shadowColor: '#e5005c',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 8,
        }}>
        <Image
          source={require('../assets/DaizoChatBot.jpeg')}
          style={{ width: 50, height: 50, borderRadius: 25 }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </View>
  );
}

const Tab = createBottomTabNavigator({
  screenOptions: function ScreenOptions() {
    const { isDark } = useTheme();
    return {
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: isDark ? '#131316' : '#ffffff',
        borderTopColor: isDark ? '#2a2a2d' : '#e4e4e7',
        borderTopWidth: 1,
        height: 76,
        paddingBottom: 12,
        paddingTop: 12,
        elevation: 0,
        shadowOpacity: 0,
      },
    };
  },

  screens: {
    One: {
      screen: One,
      options: {
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} icon={LogIn} label="Receiving" />
        ),
      },
    },
    Two: {
      screen: Two,
      options: {
        title: 'History',
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} icon={History} label="History" />
        ),
      },
    },
    AiAssistant: {
      screen: EmptyScreen,
      options: {
        title: 'AI Bot',
        headerShown: false,
        tabBarButton: () => <CenterAiTabButton />,
      },
    },
    DamageLostRecordTab: {
      screen: DamageLostRecordTab,
      options: {
        title: 'DLR',
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} icon={FileWarning} label="DLR" />
        ),
      },
    },
    Three: {
      screen: Three,
      options: {
        title: 'Settings',
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} icon={Settings} label="Settings" />
        ),
      },
    },
  },
});

export default Tab;
