import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogIn, History, Settings } from 'lucide-react-native';
import { View, Text } from 'react-native';
import One from '../screens/one';
import Three from '../screens/three';
import Two from '../screens/two';
import { useTheme } from '../context/theme';

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
  const activeBg = '#e5005c';
  const inactiveTextColor = isDark ? '#a1a1aa' : '#71717a';

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? activeBg : 'transparent',
        borderRadius: 12,
        width: 80,
        height: 52,
      }}>
      <Icon color={focused ? '#ffffff' : inactiveTextColor} size={20} />
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          color: focused ? '#ffffff' : inactiveTextColor,
          marginTop: 2,
        }}>
        {label}
      </Text>
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
        height: 80,
        paddingBottom: 15,
        paddingTop: 15,
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
