import { describe, it, expect, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { createCachingAdapter } from './caching-adapter.js';
import { RateLimitedError } from './rate-limited-error.js';

const ok = (data: unknown, config: InternalAxiosRequestConfig): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const tooManyRequests = (config: InternalAxiosRequestConfig) =>
  new AxiosError('Too Many Requests', '429', config, undefined, {
    ...ok({}, config),
    status: 429,
    statusText: 'Too Many Requests',
  });

function setup({ maxRequests = 2 }: { maxRequests?: number } = {}) {
  let time = 0;
  let calls = 0;
  const send = vi.fn(async (config: InternalAxiosRequestConfig) => ok(++calls, config));
  const client = axios.create({
    baseURL: 'https://example.com',
    adapter: createCachingAdapter({
      name: 'Example',
      send,
      freshForMs: 1_000,
      staleForMs: 10_000,
      maxRequests,
      windowMs: 60_000,
      now: () => time,
    }),
  });
  const get = async (url: string) => (await client.get<number>(url)).data;
  return { send, get, advance: (ms: number) => (time += ms) };
}

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

describe('createCachingAdapter', () => {
  it('should reuse a fresh response without sending a request', async () => {
    const { send, get } = setup();

    expect(await get('/a')).toBe(1);
    expect(await get('/a')).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('should send again once a response is no longer fresh', async () => {
    const { get, advance } = setup();

    await get('/a');
    advance(1_000);

    expect(await get('/a')).toBe(2);
  });

  it('should cache each URL separately, including its query', async () => {
    const { get } = setup();

    expect(await get('/a?x=1')).toBe(1);
    expect(await get('/a?x=2')).toBe(2);
  });

  it('should serve a stale response once the budget is spent', async () => {
    const { send, get, advance } = setup();

    await get('/a');
    await get('/b');
    advance(5_000);

    expect(await get('/a')).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('should refuse with a retry time once the budget is spent and nothing is cached', async () => {
    const { get, advance } = setup();

    await get('/a');
    advance(15_000);
    await get('/b');

    const error = await get('/c').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 45 });
  });

  it('should send again once the window has passed', async () => {
    const { get, advance } = setup({ maxRequests: 1 });

    await get('/a');
    advance(60_000);

    expect(await get('/b')).toBe(2);
  });

  it('should turn an upstream 429 into a rate limit error', async () => {
    const { send, get } = setup();
    send.mockImplementationOnce(async (requestConfig) => {
      throw tooManyRequests(requestConfig);
    });

    await expect(get('/a')).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('should pass other errors through', async () => {
    const { send, get } = setup();
    send.mockRejectedValueOnce(new AxiosError('Not Found', '404', config));

    await expect(get('/a')).rejects.toBeInstanceOf(AxiosError);
  });
});
