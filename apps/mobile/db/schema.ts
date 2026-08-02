import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Phase 1 WatermelonDB sync spike (Standing Risk #2) — mirrors
 * supabase/migrations/20260802175600_watermelon_sync_spike.sql's
 * spike_sync_notes table. Written and typechecked but not yet run on a
 * device (needs a custom dev client build — see docs/WATERMELONDB_SPIKE.md).
 */
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'spike_sync_notes',
      columns: [{ name: 'note', type: 'string' }],
    }),
  ],
});
