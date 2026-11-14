# Noesis Mobile App Setup

Noesis now has a Capacitor Android wrapper.

## Current Mobile Architecture

The native shell loads the hosted Noesis web app:

```txt
https://noesis-0--studio-4677603495-e05e8.us-east4.hosted.app
```

This keeps Firebase Auth, Firestore, App Hosting API routes, Gemini AI routes, and source metadata lookup working from the mobile app.

## Android

Install Android Studio, then run:

```bash
npm install
npm run mobile:sync
npm run mobile:open:android
```

Android Studio will open the generated `android` project. From there, choose an emulator or connected Android phone and press Run.

Always sync before building a fresh checkout. Gradle needs the generated
Capacitor plugin files, which are not all committed. With Java 21 and the Android
SDK installed, the local Android checks can also be run from the `android`
directory:

```powershell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:bundleRelease
```

A successful build does not verify native Google sign-in or produce a signed
Play Store upload. For Google sign-in, register `com.noesis.app` and the signing
certificate fingerprints for the builds being tested in Firebase, and put the
matching `google-services.json` in `android/app` locally. Test both the debug
build and the signed release with their respective signing identities.

For an upload bundle, remove any `CAPACITOR_SERVER_URL` override and sync
again. Supply the existing Play upload key through the local environment
or your build system's secret store: `NOESIS_ANDROID_KEYSTORE` (absolute
path), `NOESIS_ANDROID_STORE_PASSWORD`, `NOESIS_ANDROID_KEY_ALIAS`, and
`NOESIS_ANDROID_KEY_PASSWORD`. From `android`, run:

```powershell
.\gradlew.bat :app:bundleRelease -PnoesisSignedRelease=true
```

This mode rejects missing signing inputs, missing Firebase configuration,
and a generated Capacitor config that targets a non-production URL. Verify
the resulting AAB signature before uploading. Never commit the keystore
or its passwords. Plain `bundleRelease` is for local build checks only
and produces an unsigned bundle.

If PowerShell says `'cap' is not recognized`, dependencies are not installed in the current checkout. Run:

```bash
npm install
```

Then rerun:

```bash
npm run mobile:sync
npm run mobile:open:android
```

## Local Testing Against A Dev Server

To point the mobile shell at a trusted HTTPS development or staging server, set
`CAPACITOR_SERVER_URL` before syncing:

```bash
CAPACITOR_SERVER_URL=https://your-staging-host.example npm run mobile:sync
```

The checked-in Android network policy blocks cleartext HTTP. Keep it intact
for release builds, and resync with the override removed before packaging
production. Firebase Auth must also allow the staging domain when testing
sign-in there.

## iOS

iOS requires a Mac with Xcode:

```bash
npm run mobile:add:ios
npm run mobile:sync
npm run mobile:open:ios
```

## Important Notes

- Keep server secrets like `GEMINI_API_KEY` in Firebase App Hosting, not in the mobile app.
- Firebase Auth allowed domains and OAuth redirect settings must include the hosted Noesis domain.
- Camera and microphone are optional hardware. On a physical device, verify
  Works recording with permission granted and denied, then save and reopen the
  recording to verify upload and playback.
- The current wrapper is best for testing. Later, Noesis can add deeper native storage, offline mode, share-sheet capture, and push notifications.
