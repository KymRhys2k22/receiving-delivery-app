import { Platform, Linking, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import { supabase } from '../utils/dlr';
import appConfig from '../app.json';

export const LAST_NOTIFIED_VERSION_KEY = 'last_notified_version_code';
export const UPDATE_NOTIFICATION_CHANNEL_ID = 'app_updates';

export interface AppUpdateRecord {
  id: number;
  version_code: number;
  version_name: string;
  download_url: string;
  message?: string | null;
  is_required?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
}

let hasCheckedThisSession = false;
let listenersInitialized = false;

/**
 * Safely obtain expo-notifications without triggering Expo Go's SDK 53+ push warning crash on Android.
 * In Expo Go on Android, push notifications were removed and loading the module throws an uncaught error.
 * In production APKs (standalone builds), this loads the native module as expected.
 */
function getNotifications(): any {
  if (isRunningInExpoGo() && Platform.OS === 'android') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch (err) {
    console.warn('[appUpdateService] expo-notifications unavailable:', err);
    return null;
  }
}

/**
 * Safely obtain expo-application.
 */
function getApplication(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-application');
  } catch {
    return null;
  }
}

/**
 * Safely resolves the currently running app's numeric version code and version name.
 * 1. Checks native PackageInfo via expo-application (available in standalone / production APK).
 * 2. In Expo Go or development, falls back to app.json configuration.
 */
export function getCurrentAppVersion(): AppVersionInfo {
  let versionCode = 0;

  const Application = getApplication();
  const inExpoGo = isRunningInExpoGo();
  const isStandalone =
    !inExpoGo && Application?.applicationId === 'com.kymrhys.receivingscannerapp';

  if (isStandalone && Application?.nativeBuildVersion) {
    const parsed = parseInt(Application.nativeBuildVersion, 10);
    if (!isNaN(parsed) && parsed > 0) {
      versionCode = parsed;
    }
  }

  // Fallback to app.json configuration (used in Expo Go, dev client, or if native is unavailable)
  if (versionCode === 0) {
    const configCode = appConfig?.expo?.android?.versionCode;
    if (typeof configCode === 'number' && configCode > 0) {
      versionCode = configCode;
    } else {
      const majorStr = (appConfig?.expo?.version || '1').split('.')[0];
      const parsedMajor = parseInt(majorStr, 10);
      versionCode = !isNaN(parsedMajor) && parsedMajor > 0 ? parsedMajor : 1;
    }
  }

  const versionName =
    (isStandalone && Application?.nativeApplicationVersion) ||
    appConfig?.expo?.version ||
    `v${versionCode}`;

  return { versionCode, versionName };
}

/**
 * Configure foreground notification presentation handler and Android channel.
 */
export async function setupNotificationChannelAndHandler(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(UPDATE_NOTIFICATION_CHANNEL_ID, {
        name: 'App Updates',
        description: 'Notifications for new app version releases',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e5005c',
        showBadge: true,
      });
    }
  } catch (err) {
    console.warn('[appUpdateService] Failed to set up notification handler/channel:', err);
  }
}

/**
 * Listens for notification interaction (tap) and opens the download URL.
 * Also checks if the app was launched directly by tapping a notification while closed.
 */
export function setupNotificationListeners(): () => void {
  if (listenersInitialized) {
    return () => {};
  }
  listenersInitialized = true;

  const Notifications = getNotifications();
  if (!Notifications) {
    return () => {
      listenersInitialized = false;
    };
  }

  setupNotificationChannelAndHandler().catch(() => {});

  let subscription: any = null;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      try {
        const url = response.notification.request.content.data?.download_url;
        if (url && typeof url === 'string') {
          Linking.openURL(url).catch((err) => {
            console.warn(
              '[appUpdateService] Failed to open download URL from notification tap:',
              err
            );
          });
        }
      } catch (err) {
        console.warn('[appUpdateService] Error handling notification tap:', err);
      }
    });

    Notifications.getLastNotificationResponseAsync()
      .then((lastResponse: any) => {
        if (lastResponse) {
          const url = lastResponse.notification.request.content.data?.download_url;
          if (url && typeof url === 'string') {
            Linking.openURL(url).catch((err) => {
              console.warn('[appUpdateService] Failed to open download URL from cold launch:', err);
            });
          }
        }
      })
      .catch((err: any) => {
        console.warn('[appUpdateService] Error checking last notification response:', err);
      });
  } catch (err) {
    console.warn('[appUpdateService] Failed to initialize notification listeners:', err);
  }

  return () => {
    subscription?.remove?.();
    listenersInitialized = false;
  };
}

export interface CheckUpdateOptions {
  isManual?: boolean;
  force?: boolean;
}

/**
 * Checks Supabase for the latest app release, compares version code, and notifies user.
 * Fails gracefully and non-blockingly on network/server errors.
 *
 * NOTE: "App Up to Date" alerts are ONLY shown if isManual === true (user clicked "CHECK FOR UPDATES").
 * Automatic checks on app launch or resume are ALWAYS 100% silent if up to date.
 */
export async function checkForAppUpdate(options?: CheckUpdateOptions): Promise<void> {
  const isManual = options?.isManual ?? false;
  const force = options?.force ?? false;

  if (hasCheckedThisSession && !force && !isManual) {
    return;
  }
  hasCheckedThisSession = true;

  try {
    const current = getCurrentAppVersion();
    console.log('[appUpdateService] Checking updates. Current installed:', current);

    // Query Supabase for the highest version_code release
    const { data: latestRelease, error } = await supabase
      .from('app_updates')
      .select('*')
      .order('version_code', { ascending: false })
      .limit(1)
      .maybeSingle<AppUpdateRecord>();

    if (error) {
      console.warn('[appUpdateService] Supabase query failed:', error.message);
      if (isManual) {
        Alert.alert(
          'Update Check Failed',
          'Unable to check for updates. Please check your internet connection.'
        );
      }
      return;
    }

    if (!latestRelease || typeof latestRelease.version_code !== 'number') {
      console.log('[appUpdateService] No releases found in app_updates table');
      if (isManual) {
        Alert.alert(
          'App Up to Date',
          `You are running the latest version (${current.versionName}).`
        );
      }
      return;
    }

    console.log('[appUpdateService] Latest release in Supabase:', latestRelease);

    // Compare numerically: latest.version_code > current.version_code
    if (latestRelease.version_code <= current.versionCode) {
      console.log(
        `[appUpdateService] App is up to date (${current.versionCode} >= ${latestRelease.version_code})`
      );
      // ONLY alert if the user explicitly clicked the "CHECK FOR UPDATES" button in Settings!
      if (isManual) {
        Alert.alert(
          'App Up to Date',
          `You are running the latest version (${current.versionName}).`
        );
      }
      return;
    }

    // Check duplicate prevention: avoid spamming if we already notified for this version
    const lastNotifiedStr = await AsyncStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
    const lastNotifiedCode = lastNotifiedStr ? parseInt(lastNotifiedStr, 10) : 0;
    if (lastNotifiedCode >= latestRelease.version_code && !force && !isManual) {
      console.log(`[appUpdateService] Already notified for version ${lastNotifiedCode}`);
      return;
    }

    const messageText =
      latestRelease.message?.trim() || 'New version available. Click to download.';

    // Show immediate on-screen prompt (works in ALL environments including Expo Go)
    Alert.alert(`App Update Available (${latestRelease.version_name})`, messageText, [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Download',
        onPress: () => {
          if (latestRelease.download_url) {
            Linking.openURL(latestRelease.download_url).catch((err) => {
              console.warn('[appUpdateService] Failed to open download URL:', err);
            });
          }
        },
      },
    ]);

    // If native notifications are available (production APK / supported runtime), post OS notification
    const Notifications = getNotifications();
    if (Notifications) {
      try {
        const currentSettings = await Notifications.getPermissionsAsync();
        let granted =
          currentSettings.granted ||
          currentSettings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          granted =
            requested.granted ||
            requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        }

        if (granted) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `App Update Available (${latestRelease.version_name})`,
              body: messageText,
              data: {
                download_url: latestRelease.download_url,
                version_code: latestRelease.version_code,
                version_name: latestRelease.version_name,
              },
              sound: true,
            },
            trigger:
              Platform.OS === 'android' ? { channelId: UPDATE_NOTIFICATION_CHANNEL_ID } : null,
          });
        } else {
          console.warn('[appUpdateService] Notification permission not granted');
        }
      } catch (notifErr) {
        console.warn('[appUpdateService] Local notification schedule failed:', notifErr);
      }
    }

    // Mark version as notified to prevent duplicate spam
    await AsyncStorage.setItem(LAST_NOTIFIED_VERSION_KEY, String(latestRelease.version_code));
  } catch (err) {
    console.warn('[appUpdateService] Update check failed gracefully:', err);
  }
}

/**
 * Initializes listeners and triggers the background update check.
 * Re-checks when the app returns to the foreground.
 */
export function initAppUpdateChecker(): () => void {
  const cleanupListeners = setupNotificationListeners();

  // Run update check on startup
  checkForAppUpdate().catch((err) => {
    console.warn('[appUpdateService] Background update check error:', err);
  });

  // Throttled background check when app returns to foreground (at most once every 30 minutes)
  let lastAppStateCheck = Date.now();
  const APP_STATE_CHECK_INTERVAL = 1000 * 60 * 30; // 30 minutes

  const appStateSub = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      const now = Date.now();
      if (now - lastAppStateCheck > APP_STATE_CHECK_INTERVAL) {
        lastAppStateCheck = now;
        checkForAppUpdate({ isManual: false, force: true }).catch(() => {});
      }
    }
  });

  return () => {
    cleanupListeners();
    appStateSub.remove();
  };
}
