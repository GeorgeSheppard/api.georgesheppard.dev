import net from 'node:net';

export function varInt(n: number): Buffer {
  const bytes: number[] = [];
  let v = n;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v) b |= 0x80;
    bytes.push(b);
  } while (v);
  return Buffer.from(bytes);
}

export const packet = (id: number, payload: Buffer) => {
  const body = Buffer.concat([varInt(id), payload]);
  return Buffer.concat([varInt(body.length), body]);
};

function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | undefined {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buf.length) return undefined;
    const b = buf[offset + i];
    value |= (b & 0x7f) << (7 * i);
    if (!(b & 0x80)) return { value, size: i + 1 };
  }
  throw new Error('bad varint');
}

export function parseStatusResponse(buf: Buffer): { online: number } | undefined {
  const len = readVarInt(buf, 0);
  if (!len || buf.length < len.size + len.value) return undefined;
  let off = len.size;
  const id = readVarInt(buf, off);
  if (!id) return undefined;
  off += id.size;
  const strLen = readVarInt(buf, off);
  if (!strLen) return undefined;
  off += strLen.size;
  const json = buf.subarray(off, off + strLen.value);
  if (json.length < strLen.value) return undefined;
  const status = JSON.parse(json.toString('utf8')) as { players?: { online?: number } };
  return { online: status.players?.online ?? 0 };
}

/** Minecraft server list ping. Resolves to the online player count, or undefined if unreachable. */
export function pingPlayerCount(
  host: string,
  port = 25565,
  timeoutMs = 5000
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let data = Buffer.alloc(0);
    const done = (value: number | undefined) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => done(undefined));
    socket.on('error', () => done(undefined));
    socket.on('connect', () => {
      const hostBuf = Buffer.from(host);
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(port);
      socket.write(
        Buffer.concat([
          packet(
            0,
            Buffer.concat([varInt(767), varInt(hostBuf.length), hostBuf, portBuf, varInt(1)])
          ),
          packet(0, Buffer.alloc(0)),
        ])
      );
    });
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
      try {
        const res = parseStatusResponse(data);
        if (res) done(res.online);
      } catch {
        done(undefined);
      }
    });
  });
}
