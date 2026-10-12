import axios, { AxiosAdapter, AxiosResponse, isAxiosError } from 'axios';
import { RateLimitedError } from './rate-limited-error.js';

interface CachingAdapterOptions {
  name: string;
  send: AxiosAdapter;
  // Responses are reused without a request for this long.
  freshForMs: number;
  // Once the request budget is spent, older responses are served rather than failing.
  staleForMs: number;
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

const MAX_ENTRIES = 1_000;

// Keeps an account-wide upstream rate limit (shared by every visitor) by caching responses and
// refusing to send more than `maxRequests` per `windowMs`.
export function createCachingAdapter({
  name,
  send,
  freshForMs,
  staleForMs,
  maxRequests,
  windowMs,
  now = Date.now,
}: CachingAdapterOptions): AxiosAdapter {
  const cache = new Map<string, { response: AxiosResponse; fetchedAt: number }>();
  const sentAt: number[] = [];

  return async (requestConfig) => {
    const key = axios.getUri(requestConfig);
    const time = now();
    const cached = cache.get(key);
    const cachedWithin = (ms: number) => cached && time - cached.fetchedAt < ms;

    if (cachedWithin(freshForMs)) {
      return { ...cached!.response, config: requestConfig };
    }

    while (sentAt.length > 0 && time - sentAt[0]! >= windowMs) {
      sentAt.shift();
    }
    if (sentAt.length >= maxRequests) {
      if (cachedWithin(staleForMs)) {
        return { ...cached!.response, config: requestConfig };
      }
      const retryAfterSeconds = Math.ceil((sentAt[0]! + windowMs - time) / 1000);
      throw new RateLimitedError(`${name} rate limit reached`, retryAfterSeconds);
    }
    sentAt.push(time);

    try {
      const response = await send(requestConfig);
      cache.delete(key);
      cache.set(key, { response, fetchedAt: time });
      // Map iteration is oldest first, so this evicts the least recently fetched.
      for (const oldest of cache.keys()) {
        if (cache.size <= MAX_ENTRIES) break;
        cache.delete(oldest);
      }
      return response;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        if (cachedWithin(staleForMs)) {
          return { ...cached!.response, config: requestConfig };
        }
        throw new RateLimitedError(`${name} rate limit reached`, Math.ceil(windowMs / 1000));
      }
      throw error;
    }
  };
}
