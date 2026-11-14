import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildArtifacts, buildDockerfile } from './artifacts.js';

describe('buildDockerfile', () => {
  it('copies the plugin and omits the resource pack when there is none', () => {
    const d = buildDockerfile();
    expect(d).toContain('TYPE=PAPER VERSION=1.21.1');
    expect(d).toContain('COPY plugin.jar');
    expect(d).not.toContain('RESOURCE_PACK');
  });

  it('configures the resource pack when present', () => {
    expect(buildDockerfile('abc123')).toContain('RESOURCE_PACK_SHA1=abc123');
  });
});

describe('buildArtifacts', () => {
  it('uploads Dockerfile, jar and sources, plus a pack when assets exist', async () => {
    const files = {
      'src/main/java/a/Plugin.java': 'class A {}',
      'src/main/resources/assets/x/textures/item/a.png': Buffer.from([1]),
    };
    const out = await buildArtifacts('engine/j/', files, Buffer.from('jar'), 'A');
    expect(out.map((a) => a.key).sort()).toEqual([
      'engine/j/Dockerfile',
      'engine/j/pack.zip',
      'engine/j/plugin.jar',
      'engine/j/source.zip',
    ]);
    const pack = out.find((a) => a.key.endsWith('pack.zip'));
    const zip = await JSZip.loadAsync(pack?.body as Buffer);
    expect(Object.keys(zip.files)).toContain('assets/x/textures/item/a.png');
    expect(Object.keys(zip.files)).toContain('pack.mcmeta');
  });

  it('skips the pack without assets', async () => {
    const out = await buildArtifacts(
      'p/',
      { 'src/main/java/a/Plugin.java': 'x' },
      Buffer.from('j'),
      'A'
    );
    expect(out.some((a) => a.key.endsWith('pack.zip'))).toBe(false);
  });
});
