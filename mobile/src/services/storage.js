import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';

export const loadToken = async () => AsyncStorage.getItem(STORAGE_KEYS.token);

export const saveSession = async ({ token, user }) => {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.token, token || ''],
    [STORAGE_KEYS.user, user ? JSON.stringify(user) : ''],
  ]);
};

export const clearSession = async () => {
  await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
};

export const loadUser = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
