import { createStaticNavigation, StaticParamList } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/auth';
import Login from '../screens/login';
import Modal from '../screens/modal';
import ScanningBox from '../screens/scanningBox';
import TabNavigator from './tab-navigator';

const useIsSignedIn = () => {
  const { isSignedIn } = useAuth();
  return isSignedIn;
};

const useIsNotSignedIn = () => {
  const { isSignedIn } = useAuth();
  return !isSignedIn;
};

const Stack = createStackNavigator({
  groups: {
    unauthenticated: {
      if: useIsNotSignedIn,
      screens: {
        Login: {
          screen: Login,
          options: {
            headerShown: false,
          },
        },
      },
    },
    authenticated: {
      if: useIsSignedIn,
      screens: {
        TabNavigator: {
          screen: TabNavigator,
          options: {
            headerShown: false,
          },
        },
        Modal: {
          screen: Modal,
          options: {
            presentation: 'modal',
            headerLeft: () => null,
          },
        },
        ScanningBox: {
          screen: ScanningBox,
          options: {
            headerShown: false,
          },
        },
      },
    },
  },
});

type RootNavigatorParamList = StaticParamList<typeof Stack>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootNavigatorParamList {}
  }
}

const Navigation = createStaticNavigation(Stack);
export default Navigation;
