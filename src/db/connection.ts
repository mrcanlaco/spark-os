import Database from 'better-sqlite3';
import path from 'path';
import { SCHEMA_SQL, TABLES_SQL } from './schema';

export function createDatabase(sparkDir: string): Database.Database {
  const dbPath = path.join(sparkDir, 'spark.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(TABLES_SQL);
  return db;
}
