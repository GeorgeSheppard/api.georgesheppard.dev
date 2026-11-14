import { describe, it, expect, vi } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import { loadBaseProject } from './base.js';

vi.mock('./job-meta.js', () => ({
  readJobMeta: async () => ({ pluginId: 'p', name: 'P', prompts: ['one'] }),
}));

describe('loadBaseProject', () => {
  it('restores text files as strings and textures as buffers', async () => {
    const zip = new JSZip();
    zip.file('src/main/java/a/Plugin.java', 'class A {}');
    zip.file('src/main/resources/assets/x/textures/item/a.png', Buffer.from([137, 80]));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const s3 = {
      send: async () => ({ Body: { transformToByteArray: async () => bytes } }),
    } as unknown as S3Client;

    const base = await loadBaseProject(s3, 'engine/p/v1/');
    expect(base.meta.prompts).toEqual(['one']);
    expect(base.files['src/main/java/a/Plugin.java']).toBe('class A {}');
    expect(Buffer.isBuffer(base.files['src/main/resources/assets/x/textures/item/a.png'])).toBe(
      true
    );
  });
});
