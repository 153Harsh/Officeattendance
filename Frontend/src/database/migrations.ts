import { db } from './database';

export async function runMigrations() {
  const database = await db;
  
  return new Promise<void>((resolve, reject) => {
    database.transaction(
      tx => {
        // Create employees table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            email TEXT,
            department TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        // Create attendance table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            date TEXT NOT NULL,
            check_in TEXT,
            check_out TEXT,
            status TEXT NOT NULL DEFAULT 'PRESENT',
            latitude REAL,
            longitude REAL,
            accuracy REAL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            UNIQUE(employee_id, date)
          );
        `);

        // Create sync_queue table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL UNIQUE,
            employee_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_attempt_at TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING'
          );
        `);

        // Create app_settings table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT
          );
        `);
      },
      error => {
        console.error('Migration error:', error);
        reject(error);
      },
      () => {
        console.log('Migrations completed successfully');
        resolve();
      },
    );
  });
}