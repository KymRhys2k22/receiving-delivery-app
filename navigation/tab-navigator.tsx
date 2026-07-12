import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogIn, History, Settings } from 'lucide-react-native';
import { View, Text } from 'react-native';
import One from '../screens/one';
import Three from '../screens/three';
import Two from '../screens/two';

const Tab = createBottomTabNavigator({
  screenOptions: function ScreenOptions() {
    return {
      tabBarShowLabel: false,

      tabBarStyle: {
        backgroundColor: '#131316',
        borderTopColor: '#2a2a2d',
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
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? '#e5005c' : 'transparent',
              borderRadius: 12,
              width: 80,
              height: 52,
            }}>
            <LogIn color={focused ? '#ffffff' : '#a1a1aa'} size={20} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: focused ? '#ffffff' : '#a1a1aa',
                marginTop: 2,
              }}>
              Receiving
            </Text>
          </View>
        ),
      },
    },
    Two: {
      screen: Two,
      options: {
        title: 'History',
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? '#e5005c' : 'transparent',
              borderRadius: 12,
              width: 80,
              height: 52,
            }}>
            <History color={focused ? '#ffffff' : '#a1a1aa'} size={20} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: focused ? '#ffffff' : '#a1a1aa',
                marginTop: 2,
              }}>
              History
            </Text>
          </View>
        ),
      },
    },
    Three: {
      screen: Three,
      options: {
        title: 'Settings',
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? '#e5005c' : 'transparent',
              borderRadius: 12,
              width: 80,
              height: 52,
            }}>
            <Settings color={focused ? '#ffffff' : '#a1a1aa'} size={20} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: focused ? '#ffffff' : '#a1a1aa',
                marginTop: 2,
              }}>
              Settings
            </Text>
          </View>
        ),
      },
    },
  },
});

export default Tab;
