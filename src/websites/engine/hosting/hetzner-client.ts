export interface HostedServer {
  id: string;
  status: 'provisioning' | 'running' | 'stopped' | 'error';
  ip?: string;
}

export interface HostingProvider {
  createServer(params: { name: string; userData: string }): Promise<HostedServer>;
  getServer(id: string): Promise<HostedServer | undefined>;
  deleteServer(id: string): Promise<void>;
}

export interface HetznerOptions {
  token: string;
  serverType: string;
  location: string;
  firewallId?: number;
  baseUrl?: string;
}

interface HetznerServer {
  id: number;
  status: string;
  public_net?: { ipv4?: { ip?: string } };
}

const toStatus = (s: string): HostedServer['status'] => {
  if (s === 'running') return 'running';
  if (s === 'off') return 'stopped';
  return ['initializing', 'starting', 'migrating', 'rebuilding'].includes(s)
    ? 'provisioning'
    : 'error';
};

const toHosted = (s: HetznerServer): HostedServer => ({
  id: String(s.id),
  status: toStatus(s.status),
  ip: s.public_net?.ipv4?.ip,
});

export class HetznerProvider implements HostingProvider {
  constructor(private options: HetznerOptions) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T | undefined> {
    const res = await fetch(`${this.options.baseUrl ?? 'https://api.hetzner.cloud/v1'}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return undefined;
    if (!res.ok)
      throw new Error(`Hetzner ${method} ${path} failed: ${res.status} ${await res.text()}`);
    return res.status === 204 ? undefined : ((await res.json()) as T);
  }

  async createServer({
    name,
    userData,
  }: {
    name: string;
    userData: string;
  }): Promise<HostedServer> {
    const res = await this.call<{ server: HetznerServer }>('POST', '/servers', {
      name,
      server_type: this.options.serverType,
      image: 'docker-ce',
      location: this.options.location,
      start_after_create: true,
      public_net: { enable_ipv4: true, enable_ipv6: false },
      labels: { app: 'engine' },
      user_data: userData,
      ...(this.options.firewallId && { firewalls: [{ firewall: this.options.firewallId }] }),
    });
    if (!res) throw new Error('Hetzner returned no server');
    return toHosted(res.server);
  }

  async getServer(id: string): Promise<HostedServer | undefined> {
    const res = await this.call<{ server: HetznerServer }>('GET', `/servers/${id}`);
    return res && toHosted(res.server);
  }

  async deleteServer(id: string): Promise<void> {
    await this.call('DELETE', `/servers/${id}`);
  }
}
