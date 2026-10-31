import { db } from '../database';

export type SyncQueueItem = {
  id: number;
  event_id: string;
  employee_id: string;
  event_type: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_attempt_at: string | null;
  status: string;
};

export async function addToSyncQueue(
  eventId: string,
  employeeId: string,
  eventType: string,
  payload: object,
) {
  const database = await db;

  const now = new Date().toISOString();

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            INSERT INTO sync_queue (
              event_id,
              employee_id,
              event_type,
              payload,
              created_at,
              attempts,
              status
            )
            VALUES (?, ?, ?, ?, ?, 0, 'PENDING')
          `,
          [
            eventId,
            employeeId,
            eventType,
            JSON.stringify(payload),
            now,
          ],
          () => resolve(),
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}
export async function getAllSyncItems(): Promise<SyncQueueItem[]> {
  const database = await db;

  return new Promise<SyncQueueItem[]>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            SELECT *
            FROM sync_queue
            ORDER BY id ASC
          `,
          [],
          (_tx, result) => {
            const items: SyncQueueItem[] = [];

            for (let i = 0; i < result.rows.length; i++) {
              items.push(result.rows.item(i) as SyncQueueItem);
            }

            resolve(items);
          },
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const database = await db;

  return new Promise<SyncQueueItem[]>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            SELECT *
            FROM sync_queue
            WHERE status = 'PENDING'
            ORDER BY id ASC
          `,
          [],
          (_tx, result) => {
            const items: SyncQueueItem[] = [];

            for (let i = 0; i < result.rows.length; i++) {
              items.push(result.rows.item(i) as SyncQueueItem);
            }

            resolve(items);
          },
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}


export async function markAsSyncing(eventId: string): Promise<void> {
  const database = await db;

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            UPDATE sync_queue
            SET status = 'SYNCING'
            WHERE event_id = ?
          `,
          [eventId],
          () => resolve(),
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}

export async function markAsSynced(eventId: string): Promise<void> {
  const database = await db;

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            UPDATE sync_queue
            SET status = 'SYNCED',
                last_attempt_at = ?
            WHERE event_id = ?
          `,
          [new Date().toISOString(), eventId],
          () => {
            // Also update the corresponding attendance record to SYNCED
            // We need to parse the payload to get employeeId and date
            tx.executeSql(
              `
                SELECT employee_id, payload
                FROM sync_queue
                WHERE event_id = ?
              `,
              [eventId],
              (_, result) => {
                if (result.rows.length > 0) {
                  const { employee_id, payload } = result.rows.item(0);
                  const parsedPayload = JSON.parse(payload);
                  tx.executeSql(
                    `
                      UPDATE attendance
                      SET sync_status = 'SYNCED'
                      WHERE employee_id = ? AND date = ?
                    `,
                    [employee_id, parsedPayload.date],
                    () => resolve(),
                    (_, updateError) => {
                      reject(updateError);
                      return false;
                    }
                  );
                } else {
                  resolve();
                }
              },
              (_, selectError) => {
                reject(selectError);
                return false;
              }
            );
          },
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}

export async function markAsFailed(eventId: string): Promise<void> {
  const database = await db;

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            UPDATE sync_queue
            SET status = 'PENDING',
                attempts = attempts + 1,
                last_attempt_at = ?
            WHERE event_id = ?
          `,
          [new Date().toISOString(), eventId],
          () => resolve(),
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}

export async function markAsPermanentFailed(eventId: string): Promise<void> {
  const database = await db;

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            UPDATE sync_queue
            SET status = 'FAILED',
                attempts = attempts + 1,
                last_attempt_at = ?
            WHERE event_id = ?
          `,
          [new Date().toISOString(), eventId],
          () => resolve(),
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => {
        reject(error);
      },
    );
  });
}