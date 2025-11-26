// This file is injected into the web build to provide environment variables
if (typeof window !== 'undefined') {
  window.EXPO_FILE_SYNC_URL = 'https://tracker.tecclk.com/Tracker/api';
  window.EXPO_PUBLIC_FILE_SYNC_URL = 'https://tracker.tecclk.com/Tracker/api';
  window.EXPO_PUBLIC_RORK_API_BASE_URL = 'https://tracker.tecclk.com';
  window.EXPO_JSONBIN_KEY = '';
  window.EXPO_PUBLIC_JSONBIN_KEY = '';
  console.log('[ENV CONFIG] Environment variables loaded:', {
    FILE_SYNC_URL: window.EXPO_PUBLIC_FILE_SYNC_URL,
    API_BASE_URL: window.EXPO_PUBLIC_RORK_API_BASE_URL,
    JSONBIN_KEY_SET: !!window.EXPO_PUBLIC_JSONBIN_KEY
  });
}
