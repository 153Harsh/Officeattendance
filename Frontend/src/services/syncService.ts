import NetInfo from '@react-native-community/netinfo';

import { syncEventToBackend } from './apiClient';

import {
  getPendingSyncItems,
  markAsSyncing,
  markAsSynced,
  markAsFailed,
} from '../database/repositories/syncQueueRepository';

let isSyncing = false;

export async function syncPendingEvents(): Promise<void> {
  // Prevent multiple sync processes from running at the same time.
  if (isSyncing) {
    console.log('Sync already in progress.');
    return;
  }

  // Lock immediately before doing any async work.
  isSyncing = true;

  try {
    const networkState = await NetInfo.fetch();

    if (!networkState.isConnected) {
      console.log('Device is offline. Sync skipped.');
      return;
    }

    const pendingItems = await getPendingSyncItems();

    if (pendingItems.length === 0) {
      console.log('No pending sync events.');
      return;
    }

    console.log(
      `Starting sync. ${pendingItems.length} pending event(s).`,
    );

    for (const item of pendingItems) {
      try {
        await markAsSyncing(item.event_id);

        const payload = JSON.parse(item.payload);

        const result = await syncEventToBackend({
          eventId: item.event_id,
          employeeId: item.employee_id,
          eventType: item.event_type,
          payload,
          createdAt: item.created_at,
        });

        if (!result.success) {
          throw new Error('Backend did not confirm successful sync.');
        }

        await markAsSynced(item.event_id);

        if (result.alreadyProcessed) {
          console.log(
            `Event already processed on server: ${item.event_id}`,
          );
        } else {
          console.log(`Sync successful: ${item.event_id}`);
        }
      } catch (error) {
        console.error(`Sync failed: ${item.event_id}`, error);

        try {
          await markAsFailed(item.event_id);
        } catch (queueError) {
          console.error(
            `Failed to update sync queue for ${item.event_id}:`,
            queueError,
          );
        }
      }
    }

    console.log('Sync process completed.');
  } finally {
    isSyncing = false;
  }
}