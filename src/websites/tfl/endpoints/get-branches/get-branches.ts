import { z } from 'zod';
import { Context } from 'hono';
import { getCachedRouteSequence } from '../../utils/route-sequence-cache.js';
import { deriveBranches } from '../../utils/branches.js';

export const GetBranchesQuerySchema = z.object({
  stopPointId: z.string().min(1).describe('TfL StopPoint ID to board at'),
  lineId: z.string().min(1).describe('e.g. "district"'),
  direction: z.enum(['inbound', 'outbound']).describe('Direction of travel from stopPointId'),
});

export type GetBranchesQuery = z.infer<typeof GetBranchesQuerySchema>;

export const BranchSchema = z.object({
  terminus: z.string().describe('The branch\'s actual far terminus, e.g. "Wimbledon"'),
  destinations: z
    .array(z.string())
    .describe(
      'Every station downstream of stopPointId on this branch, in travel order — i.e. every ' +
        "value a live arrival's destinationName could legitimately take for a train still on " +
        'this branch, including ones that short-turn before reaching the terminus'
    ),
  label: z
    .string()
    .describe(
      'Display label — usually just the terminus, but disambiguated with TfL\'s own "via X" ' +
        'naming when another branch from this stop shares the same terminus (e.g. the Northern ' +
        'line\'s "Morden via Bank" vs "Morden via Charing Cross")'
    ),
});

export const GetBranchesResponseSchema = z.object({
  branches: z.array(BranchSchema),
});

export type GetBranchesResponse = z.infer<typeof GetBranchesResponseSchema>;

export async function getBranches(
  c: Context,
  input: GetBranchesQuery
): Promise<GetBranchesResponse> {
  const tflClient = c.get('tflClient');
  const routeSequence = await getCachedRouteSequence(
    tflClient.getClient(),
    input.lineId,
    input.direction
  );
  const branches = deriveBranches(routeSequence, input.stopPointId);

  return { branches };
}
