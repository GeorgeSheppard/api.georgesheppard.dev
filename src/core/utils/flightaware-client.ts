import axios, { AxiosInstance } from 'axios';
import { config } from '@config/index.js';
import { createCachingAdapter } from './caching-adapter.js';

const FLIGHTAWARE_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

// The Personal tier allows 10 result sets a minute across the whole account, and each one is
// billed, so flight data is reused for a few minutes and served stale rather than over the limit.
const REQUESTS_PER_MINUTE = 10;
const FRESH_FOR_MS = 5 * 60_000;
const STALE_FOR_MS = 60 * 60_000;

export class FlightAwareClientWrapper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: FLIGHTAWARE_BASE_URL,
      headers: { 'x-apikey': config.FLIGHTAWARE_API_KEY },
      adapter: createCachingAdapter({
        name: 'FlightAware',
        send: axios.getAdapter(axios.defaults.adapter),
        freshForMs: FRESH_FOR_MS,
        staleForMs: STALE_FOR_MS,
        maxRequests: REQUESTS_PER_MINUTE,
        windowMs: 60_000,
      }),
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(config.FLIGHTAWARE_API_KEY);
  }
}
