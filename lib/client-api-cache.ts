type ApiCacheEntry = { value: any; savedAt: number };

const apiCache = new Map<string, ApiCacheEntry>();
const apiRequests = new Map<string, Promise<any>>();
const CACHE_FRESH_MS = 5000;
const CACHE_STALE_MS = 30000;

/**
 * Shared browser cache for authenticated API reads:
 * - reuse requests in flight to prevent request storms during route changes;
 * - reuse very recent successful responses;
 * - preserve recent data on transient server/network errors;
 * - never serve cached private data after a 401/403 response.
 */
export async function fetchJsonCached(url: string): Promise<any> {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && now - cached.savedAt < CACHE_FRESH_MS) return cached.value;

  const pending = apiRequests.get(url);
  if (pending) return pending;

  const request = (async () => {
    let rejectStaleCache = false;
    try {
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        if (response.status === 401 || response.status === 403) {
          rejectStaleCache = true;
          apiCache.delete(url);
          throw new Error(result?.error || "Sessione non valida.");
        }
        if (!cached || Date.now() - cached.savedAt > CACHE_STALE_MS) {
          throw new Error(result?.error || `Richiesta fallita (${response.status})`);
        }
        return cached.value;
      }

      apiCache.set(url, { value: result, savedAt: Date.now() });
      return result;
    } catch (error) {
      if (!rejectStaleCache && cached && Date.now() - cached.savedAt <= CACHE_STALE_MS) return cached.value;
      throw error;
    } finally {
      apiRequests.delete(url);
    }
  })();

  apiRequests.set(url, request);
  return request;
}

export function invalidateApiCache(urlPrefix?: string) {
  if (!urlPrefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.startsWith(urlPrefix)) apiCache.delete(key);
  }
}
