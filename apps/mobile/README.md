# Student app (Expo / React Native)

Arabic, RTL student app: login/register, course list and search, course page, "my courses" with progress,
an HLS player (AES-128) with a moving watermark, and account/devices. API contract: `docs/API.md`.

This folder is **not** an npm workspace. Install and run everything from `apps/mobile`:

```bash
cd apps/mobile
npm install            # never at the repo root for this app
```

`@lp/shared` is a `file:../../packages/shared` dependency; `metro.config.js` watches that folder.

## API URL

The base URL is read at bundle time from `EXPO_PUBLIC_API_URL` (fallback `http://10.0.2.2:4000/api/v1`,
which is the host machine from the Android emulator).

```bash
# local dev, physical device on the same Wi-Fi: use your PC's LAN IP
echo EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1 > .env.local
```

For EAS builds the value comes from the `env` block of the profile in `eas.json`
(`preview` / `production` point at `https://api.example.com/api/v1`: change it to the real API).
The API's `PUBLIC_API_URL` must be reachable from the phone too, because `playbackUrl`, the key URL and the
signed segment links are built from it.

## Dev build (required: the player does not run in Expo Go)

expo-video, expo-secure-store and expo-screen-capture are native modules, so use a development build:

```bash
npm install -g eas-cli
eas login
eas init                                   # once, links the project to your Expo account
eas build --profile development --platform android   # installable APK
eas build --profile development --platform ios       # registered devices (eas device:create)
eas build --profile development-simulator --platform ios
```

Install the build on the device, then start the dev server:

```bash
npx expo start --dev-client
```

Local native builds also work if you have Android Studio / Xcode: `npx expo run:android` / `npx expo run:ios`.

### Local Android build on Windows

Gesture Handler and Reanimated (pulled in by expo-router) generate C++ object paths longer than 260 characters.
The SDK's default CMake 3.22.1 ships a Ninja that cannot handle them (`Filename longer than 260 characters`).
Fix, once per machine/checkout:

1. Windows long paths enabled (`LongPathsEnabled = 1`, usually already on).
2. Install CMake 3.31.6 from Android Studio → SDK Manager → SDK Tools → CMake.
3. After `npx expo prebuild` (or the first `expo run:android`), add to `android/local.properties`:
   ```
   cmake.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk\\cmake\\3.31.6
   ```
4. Keep the project in a short folder (e.g. `C:\lp\apps\mobile`); a `subst` drive does not help because Node resolves it back to the real path.

The emulator reaches the PC's localhost as `10.0.2.2`, which is the default `EXPO_PUBLIC_API_URL`. The API's
`PUBLIC_API_URL` / `MEDIA_PUBLIC_URL` must also use `10.0.2.2` so playlist and segment links work inside the emulator.
Screenshots of the player screen come out black on purpose (`FLAG_SECURE`).

## Test / store builds

- `eas build --profile preview --platform android`: internal APK.
- `eas build --profile preview --platform ios` then `eas submit --profile preview --platform ios`: TestFlight.
- `production`: store builds (`app-bundle` on Android).

## Notes

- Bundle ids: `com.lectures.student` (iOS and Android).
- App Store rule 3.1.1: there is no code-redemption screen, no price and no purchase wording anywhere in the
  app (both platforms). Non-enrolled users see "هذا المحتوى متاح للمشتركين". Codes are redeemed on the website.
- The deviceId is generated once per install and kept in secure storage; logout clears the tokens but keeps
  the deviceId so the same device slot is reused on the next login.
- Screen protection: `preventScreenCaptureAsync` runs while the player screen is focused. On Android this is
  FLAG_SECURE (no screenshots or recordings). On iOS expo-screen-capture covers the window natively while the
  screen is recorded or mirrored, and hides content from screenshots on iOS 13+; the app also shows a notice
  after a screenshot. expo-screen-capture 58.0.x has no JS event for the recording state, so the app does not
  pause the video itself during a recording (the picture is covered, the audio keeps playing).
- Quality: "auto" plays the master playlist (adaptive); a fixed quality plays that rendition's variant playlist.
- Native full screen and picture-in-picture are disabled so the watermark is always drawn; the full-screen
  button in the player rotates to landscape inside the app instead.
