# CodeAlchemist Mobile (Expo)

This Expo app uses the same backend endpoints as the web client.

## Endpoints used

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/ask`

## Configure API base

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_BASE`.

Common values:

- Android emulator: `http://10.0.2.2:5000`
- iOS simulator: `http://localhost:5000`
- Physical device: `http://<your-computer-lan-ip>:5000`
## Google sign-in

Google sign-in requires a development build or standalone build on Android/iOS.
Expo Go does not support the custom native redirect scheme that Google auth needs.

Set these environment variables in `.env`:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_EXPO_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID`

Then rebuild the app for the platform you want to test.

## Run

```bash
npm install
npm run start
```

Then open on Android/iOS using Expo Go.
