export type EngineJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface EngineJobMeta {
  pluginId: string;
  name: string;
  summary: string;
  mcVersion: string;
  loader: string;
  artifacts: string[];
}

export type EngineServerStatus = 'provisioning' | 'running' | 'deleted' | 'failed';
