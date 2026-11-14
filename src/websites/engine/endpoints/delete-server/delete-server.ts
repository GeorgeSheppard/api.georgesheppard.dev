import { z } from 'zod';
import type { SweepDeps } from '../../hosting/sweeper.js';
import { deleteServerById } from '../../hosting/sweeper.js';

export const DeleteServerParamsSchema = z.object({ id: z.string().uuid().describe('Server ID') });
export const DeleteServerResponseSchema = z.object({ deleted: z.literal(true) });

export const deleteEngineServer = (deps: SweepDeps, id: string) => deleteServerById(deps, id);
