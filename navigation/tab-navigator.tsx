import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogIn, History, Settings, FileWarning } from 'lucide-react-native';
import { View, Text } from 'react-native';
import One from '../screens/one';
import Three from '../screens/three';
import Two from '../screens/two';
import DamageLostRecordScreen from '../screens/damageLostRecord';
import { useTheme } from '../context/theme';



function DamageLostRecordTab(props: any) {
  return <DamageLostRecordScreen {...props} embedded />;
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
        width: 72,
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
