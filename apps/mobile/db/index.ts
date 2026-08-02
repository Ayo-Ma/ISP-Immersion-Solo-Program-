import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import SpikeSyncNote from './models/SpikeSyncNote';

const adapter = new SQLiteAdapter({
  schema,
  // Matches the Expo plugin's default (app.json) — JSI support for Android.
  jsi: true,
  onSetUpError: (error) => {
    console.error('[watermelondb] setup error', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [SpikeSyncNote],
});
