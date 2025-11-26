const FALLBACK_BASE_URL = 'http://localhost:8081';

type RuntimeEnv = {
  EXPO_PUBLIC_RORK_API_BASE_URL?: string;
  __ENV__?: {
    API_BASE_URL?: string;
  };
  location?: {
    origin?: string;
    hostname?: string;
  };
};

const normalizeUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const shouldUseHostOrigin = (hostname?: string) => {
  if (!hostname) {
    return false;
  }

  const normalizedHost = hostname.toLowerCase();
  return normalizedHost === 'rork.app' || normalizedHost.endsWith('.rork.app');
};

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const runtime = window as typeof window & RuntimeEnv;
    const runtimeOverride = normalizeUrl(
      runtime.EXPO_PUBLIC_RORK_API_BASE_URL ?? runtime.__ENV__?.API_BASE_URL ?? null,
    );

    if (runtimeOverride) {
      return runtimeOverride;
    }

    if (shouldUseHostOrigin(runtime.location?.hostname) && runtime.location?.origin) {
      return runtime.location.origin;
    }
  }

  const envOverride = normalizeUrl(process.env.EXPO_PUBLIC_RORK_API_BASE_URL ?? null);
  if (envOverride) {
    return envOverride;
  }

  return FALLBACK_BASE_URL;
};
