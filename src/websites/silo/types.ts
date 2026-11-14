export type SiloJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SiloJobResult {
  pluginId: string;
  name: string;
  summary: string;
  mcVersion: string;
  loader: string;
  s3Prefix: string;
}
