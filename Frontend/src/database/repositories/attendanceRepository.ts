import { db } from '../database';

export type Attendance = {
  id: number;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
};

export async function createCheckIn(
  employeeId: string,
  latitude: number,
  longitude: number,
  accuracy: number,
) {
  const database = await db;

  const now = new Date().toISOString();
  const date = now.split('T')[0];

  return new Promise<void>((resolve, reject) => {
    database.transaction(tx => {
      tx.executeSql(
        `
          INSERT INTO attendance (
            employee_id,
            date,
            check_in,
            status,
            latitude,
            longitude,
            accuracy,
            created_at,
            updated_at,
            sync_status
          )
          VALUES (?, ?, ?, 'PRESENT', ?, ?, ?, ?, ?, 'PENDING')
        `,
        [
          employeeId,
          date,
          now,
          latitude,
          longitude,
          accuracy,
          now,
          now,
        ],
        () => resolve(),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}
export async function createCheckOut(
  employeeId: string,
  latitude: number,
  longitude: number,
  accuracy: number,
) {
  const database = await db;
  const now = new Date().toISOString();
  const date = now.split('T')[0];

  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        tx.executeSql(
          `
            UPDATE attendance
            SET check_out = ?,
                latitude = ?,
                longitude = ?,
                accuracy = ?,
                updated_at = ?
            WHERE employee_id = ?
              AND date = ?
              AND check_in IS NOT NULL
              AND check_out IS NULL
          `,
          [now, latitude, longitude, accuracy, now, employeeId, date],
          (_tx, result) => {
            if (result.rowsAffected === 0) {
              reject(
                new Error(
                  'No active Check-In found for today or already checked out.',
                ),
              );
              return;
            }
            resolve();
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

export async function getTodayAttendance(
  employeeId: string,
): Promise<Attendance | null> {
  const database = await db;

  const date = new Date().toISOString().split('T')[0];

  return new Promise<Attendance | null>((resolve, reject) => {
    database.transaction(tx => {
      tx.executeSql(
        `
          SELECT *
          FROM attendance
          WHERE employee_id = ?
            AND date = ?
          LIMIT 1
        `,
        [employeeId, date],
        (_, result) => {
          if (result.rows.length === 0) {
            resolve(null);
          } else {
            resolve(result.rows.item(0) as Attendance);
          }
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}