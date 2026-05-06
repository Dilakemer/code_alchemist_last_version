import { Platform } from 'react-native';
import Constants from 'expo-constants';

const normalizeBase = (url) => (url || '').replace(/\/$/, '');

const getExpoHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';

  if (!hostUri) return '';
  return hostUri.split(':')[0];
};

const getFallbackApiBase = () => {
  const expoHost = getExpoHost();
  if (expoHost) {
    return `http://${expoHost}:5000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  return 'http://localhost:5000';
};

export const API_BASE = normalizeBase(process.env.EXPO_PUBLIC_API_BASE || getFallbackApiBase());
export const SOCKET_BASE = normalizeBase(process.env.EXPO_PUBLIC_SOCKET_BASE || API_BASE);

export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '522794929208-pm29ue7nga28fbq4ia9kmdm2457055vd.apps.googleusercontent.com';
export const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID || '';
export const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID || '';

export const CLIENT_SOURCE = 'mobile';
export const STORAGE_KEYS = {
  token: 'codebrain_token',
  user: 'codebrain_user',
};
