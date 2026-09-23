import AsyncStorage from '@react-native-async-storage/async-storage';

/** JSON persistence that never throws: storage may be unavailable. */
export async function loadJson<T>(
  key: string,
  isValid: (value: unknown) => value is T
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is a convenience; failures are non fatal.
  }
}
