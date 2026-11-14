import { describe, it, expect } from 'vitest';
import { cloudInit } from './cloud-init.js';

describe('cloudInit', () => {
  it('downloads every file, builds and runs the image, and blocks metadata access', () => {
    const out = cloudInit([
      { name: 'Dockerfile', url: 'https://s3/x?sig=a&b=c' },
      { name: 'plugin.jar', url: "https://s3/y'z" },
    ]);
    expect(out.startsWith('#cloud-config')).toBe(true);
    expect(out).toContain("curl -fsSL -o 'Dockerfile' 'https://s3/x?sig=a&b=c'");
    expect(out).toContain(`'https://s3/y'\\''z'`);
    expect(out).toContain('docker build -t mc .');
    expect(out).toContain('--restart unless-stopped');
    expect(out).toContain('169.254.169.254 -j DROP');
    expect(out).not.toContain('Bearer');
  });
});
