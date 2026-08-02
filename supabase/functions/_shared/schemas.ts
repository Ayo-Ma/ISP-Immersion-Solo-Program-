// Deno runtime (Supabase Edge Functions) — twin of the Edge Function
// schemas in packages/shared-types/src/index.ts, same reasoning as
// _shared/logger.ts: Supabase's documented deploy pattern bundles shared
// edge-function code from supabase/functions/_shared, not from outside the
// functions directory, so this is a real npm package (zod) re-declared
// here rather than a cross-directory import. Keep the two in sync by hand.

import { z } from 'npm:zod@3';

export const createPathwayRequestInputSchema = z.object({
  pathwayId: z.string().uuid(),
});

export const reassignBuilderInputSchema = z.object({
  discipleId: z.string().uuid(),
  newBuilderId: z.string().uuid(),
  reason: z.string().min(1, 'reason is required — Section F2 preserves it on the ended pairing'),
});

export const recordTestAttemptInputSchema = z.object({
  moduleProgressId: z.string().uuid(),
  score: z.number().min(0).max(100),
});
