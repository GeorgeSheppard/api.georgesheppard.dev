import { describe, it, expect } from 'vitest';
import net from 'node:net';
import { pingPlayerCount, packet, varInt, parseStatusResponse } from './status-ping.js';

const statusPacket = (online: number) => {
  const json = Buffer.from(JSON.stringify({ players: { online, max: 20 } }));
  return packet(0, Buffer.concat([varInt(json.length), json]));
};

describe('parseStatusResponse', () => {
  it('reads the online count from a complete packet', () => {
    expect(parseStatusResponse(statusPacket(3))).toEqual({ online: 3 });
  });
  it('waits for more data on a partial packet', () => {
    expect(parseStatusResponse(statusPacket(3).subarray(0, 5))).toBeUndefined();
  });
});

describe('pingPlayerCount', () => {
  it('returns the player count from a server', async () => {
    const server = net.createServer((s) => s.on('data', () => s.write(statusPacket(4))));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as net.AddressInfo;
    expect(await pingPlayerCount('127.0.0.1', port, 2000)).toBe(4);
    server.close();
  });

  it('returns undefined when nothing is listening', async () => {
    const server = net.createServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as net.AddressInfo;
    await new Promise((r) => server.close(r));
    expect(await pingPlayerCount('127.0.0.1', port, 500)).toBeUndefined();
  });
});
