
// src/lib/db.ts
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Define the path to the database file
const DB_PATH = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), '.data/radiusedge.db') // In production, use a .data directory
  : path.join(process.cwd(), 'radiusedge.db');    // In development, use project root

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    const verboseSqlite3 = sqlite3.verbose();
    dbInstance = await open({
      filename: DB_PATH,
      driver: verboseSqlite3.Database,
    });
    // Ensure WAL mode is enabled for better concurrency, if appropriate for your setup
    // await dbInstance.exec('PRAGMA journal_mode = WAL;');
    await initializeDatabaseSchema(dbInstance);
  }
  return dbInstance;
}

async function initializeDatabaseSchema(db: Database): Promise<void> {
  console.log('Initializing database schema...');

  // Scenarios Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      variables TEXT,    -- Store as JSON string
      steps TEXT,        -- Store as JSON string
      lastModified TEXT, -- Store as ISO8601 string
      tags TEXT          -- Store as JSON string (array of strings)
    );
  `);
  console.log('Scenarios table checked/created.');

  // Packets Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS packets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      attributes TEXT,   -- Store as JSON string of {id, name, value} array
      lastModified TEXT, -- Store as ISO8601 string
      tags TEXT          -- Store as JSON string (array of strings)
    );
  `);
  console.log('Packets table checked/created.');

  // Server Configurations Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS server_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      host TEXT,
      sshPort INTEGER,
      sshUser TEXT,
      authMethod TEXT,
      privateKey TEXT,
      password TEXT,
      radiusAuthPort INTEGER,
      radiusAcctPort INTEGER,
      defaultSecret TEXT,
      nasSpecificSecrets TEXT,      -- Store as JSON string (object)
      status TEXT,
      testSteps TEXT,               -- Store as JSON string (array of TestStepConfig)
      scenarioExecutionSshCommands TEXT -- Store as JSON string (array of SshExecutionStep)
    );
  `);
  console.log('Server Configurations table checked/created.');

  // Database Connection Configurations Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS db_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT, -- 'mysql', 'postgresql', etc.
      host TEXT,
      port INTEGER,
      username TEXT,
      password TEXT,
      databaseName TEXT,
      status TEXT, -- 'connected_validated', 'connection_error', etc.
      sshPreambleSteps TEXT, -- Store as JSON string (array of DbSshPreambleStepConfig)
      validationSteps TEXT   -- Store as JSON string (array of DbValidationStepConfig)
    );
  `);
  console.log('Database Configurations table checked/created.');

  // Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT, -- 'admin', 'editor', 'viewer', 'operator'
      status TEXT, -- 'active', 'invited', 'suspended'
      lastLogin TEXT, -- Store as ISO8601 string or similar
      passwordHash TEXT -- For storing hashed passwords (actual hashing logic TBD)
    );
  `);
  console.log('Users table checked/created.');

  // Dictionaries Table (for metadata)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dictionaries (
      id TEXT PRIMARY KEY,    -- e.g., 'std', '3gpp', 'custom-acme_corp'
      name TEXT NOT NULL,     -- e.g., 'Standard RADIUS', '3GPP VSAs', 'ACME Corp Custom'
      source TEXT,            -- e.g., 'Standard', '3GPP', 'Custom Upload'
      isActive BOOLEAN DEFAULT TRUE,
      lastUpdated TEXT        -- Store as ISO8601 string
    );
  `);
  console.log('Dictionaries table checked/created.');

  // Test Results Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      scenarioName TEXT NOT NULL,
      status TEXT NOT NULL, -- 'Pass', 'Fail', 'Warning'
      timestamp TEXT NOT NULL, -- ISO8601 string
      latencyMs INTEGER,
      server TEXT,
      details TEXT -- JSON string for logs, SQL results, etc.
    );
  `);
  console.log('Test Results table checked/created.');

  console.log('Database schema initialization complete.');
}

// Optional: Call getDb once when the module loads to ensure the DB is initialized early in development.
// In a serverless environment, you might prefer to initialize on first request.
if (process.env.NODE_ENV !== 'production') {
  getDb().catch(err => console.error("Failed to initialize DB on module load:", err));
}

