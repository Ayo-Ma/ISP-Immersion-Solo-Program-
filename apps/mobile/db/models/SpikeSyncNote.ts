import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class SpikeSyncNote extends Model {
  static table = 'spike_sync_notes';

  @field('note') note!: string;
}
