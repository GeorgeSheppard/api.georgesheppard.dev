import { describe, it, expect, vi, afterEach } from 'vitest';
import { HetznerProvider } from './hetzner-client.js';

const provider = new HetznerProvider({
  token: 'tok',
  serverType: 'cpx21',
  location: 'nbg1',
  firewallId: 7,
});

const respond = (status: number, body?: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(body ? JSON.stringify(body) : null, { status }));

afterEach(() => vi.restoreAllMocks());

describe('HetznerProvider', () => {
  it('creates a labelled server with cloud-init and firewall', async () => {
    const spy = respond(201, {
      server: { id: 5, status: 'initializing', public_net: { ipv4: { ip: '9.9.9.9' } } },
    });
    const s = await provider.createServer({ name: 'n', userData: '#cloud-config' });
    expect(s).toEqual({ id: '5', status: 'provisioning', ip: '9.9.9.9' });
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('https://api.hetzner.cloud/v1/servers');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      name: 'n',
      server_type: 'cpx21',
      labels: { app: 'engine' },
      user_data: '#cloud-config',
      firewalls: [{ firewall: 7 }],
    });
  });

  it('returns undefined for a missing server', async () => {
    respond(404);
    expect(await provider.getServer('1')).toBeUndefined();
  });

  it('throws on API errors', async () => {
    respond(401, { error: 'nope' });
    await expect(provider.deleteServer('1')).rejects.toThrow('401');
  });
});
