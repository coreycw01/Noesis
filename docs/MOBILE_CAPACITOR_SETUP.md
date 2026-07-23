# Noesis Mobile App Setup

Noesis now has a Capacitor Android wrapper.

## Current Mobile Architecture

The native shell loads the hosted Noesis web app:

```txt
https://studio-4677603495-e05e8.firebaseapp.com
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

To point the mobile shell at a local development server, set `CAPACITOR_SERVER_URL` before syncing:

```bash
CAPACITOR_SERVER_URL=http://10.0.0.232:9002 npm run mobile:sync
```

Use your computer's LAN IP, not `localhost`, when testing on a real phone.

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
- Recordings, drawings, and uploaded files should move to Firebase Storage before App Store testing.
- The current wrapper is best for testing. Later, Noesis can add deeper native storage, offline mode, share-sheet capture, and push notifications.
