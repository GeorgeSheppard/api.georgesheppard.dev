import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import * as C from './config.js';
import type { Files } from './types.js';

export interface Artifact {
  key: string;
  body: Buffer | string;
  contentType: string;
}

const ASSETS_PREFIX = 'src/main/resources/assets/';

export async function buildResourcePack(files: Files, name: string): Promise<Buffer | undefined> {
  const assets = Object.entries(files).filter(([p]) => p.startsWith(ASSETS_PREFIX));
  if (!assets.length) return undefined;
  const zip = new JSZip();
  for (const [p, content] of assets) zip.file(p.replace('src/main/resources/', ''), content);
  zip.file(
    'pack.mcmeta',
    JSON.stringify({ pack: { pack_format: 34, description: `${name} resource pack` } })
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function buildDockerfile(packSha1?: string): string {
  const lines = [
    'FROM itzg/minecraft-server',
    `ENV EULA=TRUE TYPE=PAPER VERSION=${C.MC_VERSION} ONLINE_MODE=FALSE MODE=creative MEMORY=3G`,
    'COPY plugin.jar /plugins/plugin.jar',
  ];
  if (packSha1) {
    lines.push(
      'COPY pack.zip /data/resourcepack.zip',
      `ENV RESOURCE_PACK=file:///data/resourcepack.zip RESOURCE_PACK_SHA1=${packSha1} RESOURCE_PACK_REQUIRED=false`
    );
  }
  return lines.join('\n') + '\n';
}

export async function buildArtifacts(
  prefix: string,
  files: Files,
  jar: Buffer,
  name: string
): Promise<Artifact[]> {
  const pack = await buildResourcePack(files, name);
  const sources = new JSZip();
  for (const [p, content] of Object.entries(files)) sources.file(p, content);
  const artifacts: Artifact[] = [
    {
      key: `${prefix}Dockerfile`,
      body: buildDockerfile(pack && createHash('sha1').update(pack).digest('hex')),
      contentType: 'text/plain',
    },
    { key: `${prefix}plugin.jar`, body: jar, contentType: 'application/java-archive' },
    {
      key: `${prefix}source.zip`,
      body: await sources.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
      contentType: 'application/zip',
    },
  ];
  if (pack)
    artifacts.push({ key: `${prefix}pack.zip`, body: pack, contentType: 'application/zip' });
  return artifacts;
}
