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

export const CLIENT_SOURCE = 'mobile';
export const STORAGE_KEYS = {
  token: 'codebrain_token',
  user: 'codebrain_user',
};
