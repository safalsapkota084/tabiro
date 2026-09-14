export function readList(storage, key, validate) {
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(validate) : [];
  } catch { return []; }
}
export function safeWrite(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function getStorage(type = 'localStorage') {
  try { return window[type]; } catch { return null; }
}
export function readProfile(storage) {
  try {
    const value = JSON.parse(storage.getItem('tabiro-demo-profile'));
    return value && typeof value.name === 'string' && value.name.trim() && value.name.length <= 60 ? { name: value.name } : null;
  } catch { return null; }
}
