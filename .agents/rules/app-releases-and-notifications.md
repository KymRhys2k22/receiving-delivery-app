# App Releases, Supabase Updates & Notifications Guidelines

## 1. App Versioning Invariants
- When releasing a new version, always update both:
  1. `app.json`: `expo.version` (e.g. `"6.0.0"`) and `expo.android.versionCode` (e.g. `6`).
  2. `android/app/build.gradle`: `versionCode 6` and `versionName "6.0.0"`.
- Never compare version strings lexicographically (e.g., `'v10' < 'v9'`). Always use numeric `version_code` comparison (`latest.version_code > current.versionCode`).
- Runtime version detection must read `Application.nativeBuildVersion` from `expo-application` with a safe fallback to `app.json` `expo.android.versionCode`.

## 2. Supabase `app_updates` Table Workflow
- When publishing a new APK release to GitHub:
  - Upload APK to GitHub Releases (e.g., `v6`).
  - Insert or update the release row in `public.app_updates` with the matching integer `version_code` and GitHub `download_url`.
  - Do not alter or hardcode URLs in client APKs; client updates are controlled dynamically via Supabase.
- Mobile clients must only have public `SELECT` (read) access via Row Level Security (RLS). Never expose service-role keys or grant write permissions to the client.

## 3. Expo Notifications (SDK 56+)
- Use modern `NotificationBehavior` property names:
  ```ts
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  ```
- Android 13+ requires `android.permission.POST_NOTIFICATIONS` declared in `app.json` and `AndroidManifest.xml`, and requested via `Notifications.requestPermissionsAsync()`.
- Channel configuration: Android notifications require a channel with `AndroidImportance.MAX` (e.g., `app_updates`).
- Duplicate Prevention: Track the last notified `version_code` in `@react-native-async-storage/async-storage` under key `last_notified_version_code` plus an in-memory session flag.
- Non-blocking startup: Update checks must always run in the background and fail gracefully on network or database errors without crashing or delaying app render.
