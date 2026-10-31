import { runMigrations } from './migrations';

let initialized = false;

export async function initializeDatabase() {
  if (initialized) {
    return;
  }

  await runMigrations();

  initialized = true;
}