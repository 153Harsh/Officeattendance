import { db } from '../database';

export async function setSetting(
  key: string,
  value: string,
): Promise<void> {
  const database = await db;

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            INSERT OR REPLACE INTO app_settings (key, value)
            VALUES (?, ?)
          `,
          [key, value],
          () => resolve(),
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => reject(error),
    );
  });
}

export async function getSetting(
  key: string,
): Promise<string | null> {
  const database = await db;

  return new Promise<string | null>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            SELECT value
            FROM app_settings
            WHERE key = ?
            LIMIT 1
          `,
          [key],
          (_tx, result) => {
            if (result.rows.length === 0) {
              resolve(null);
              return;
            }

            resolve(result.rows.item(0).value ?? null);
          },
          (_tx, error) => {
            reject(error);
            return false;
          },
        );
      },
      error => reject(error),
    );
  });
}