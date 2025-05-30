
// src/lib/db.ts
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Define the path to the database file
const DB_PATH = process.env.NODE_ENV === 'production'
  ? path.join(process.cwd(), '.data/radiusedge.db') // In production, use a .data directory
  : path.join(process.cwd(), 'radiusedge.db');    // In development, use project root

let dbInstance: Database | null = null;

// Helper for logging with prefixes for clarity in server logs
function console_log_info(message: string, ...optionalParams: any[]) {
  // Using console.log for potentially better visibility in some server environments
  console.log(`[DB_INIT INFO] ${message}`, ...optionalParams);
}
function console_log_warn(message: string, ...optionalParams: any[]) {
  console.log(`[DB_INIT WARN] ${message}`, ...optionalParams);
}
function console_log_error(message: string, ...optionalParams: any[]) {
  console.log(`[DB_INIT ERROR] ${message}`, ...optionalParams);
}


export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    console_log_info('Attempting to open database at:', DB_PATH);
    const verboseSqlite3 = sqlite3.verbose();
    // Ensure the directory exists in production
    if (process.env.NODE_ENV === 'production') {
        const fs = await import('fs/promises');
        try {
            await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
            console_log_info('Ensured .data directory exists for production.');
        } catch (err) {
            console_log_error('Failed to create .data directory:', err);
        }
    }
    dbInstance = await open({
      filename: DB_PATH,
      driver: verboseSqlite3.Database,
    });
    console_log_info('Database opened successfully.');
    await initializeDatabaseSchema(dbInstance);
  }
  return dbInstance;
}

async function initializeDatabaseSchema(db: Database): Promise<void> {
  console_log_info('Initializing database schema (v3 with robust dictionary check)...');

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

  // Test Executions Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS test_executions (
      id TEXT PRIMARY KEY,
      scenarioId TEXT,
      scenarioName TEXT NOT NULL,
      serverId TEXT,
      serverName TEXT NOT NULL,
      startTime TEXT NOT NULL,    -- ISO8601 string
      endTime TEXT,             -- ISO8601 string, nullable
      status TEXT NOT NULL,       -- 'Running', 'Completed', 'Failed', 'Aborted'
      resultId TEXT,             -- Nullable, could link to test_results.id
      FOREIGN KEY (scenarioId) REFERENCES scenarios(id) ON DELETE SET NULL,
      FOREIGN KEY (serverId) REFERENCES server_configs(id) ON DELETE SET NULL,
      FOREIGN KEY (resultId) REFERENCES test_results(id) ON DELETE SET NULL
    );
  `);

  // Execution Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      testExecutionId TEXT NOT NULL,
      timestamp TEXT NOT NULL,    -- ISO8601 string
      level TEXT NOT NULL,        -- 'INFO', 'ERROR', 'SSH_CMD', 'SSH_OUT', 'SENT', 'RECV'
      message TEXT NOT NULL,
      rawDetails TEXT,             -- JSON string for raw packets, command output, etc.
      FOREIGN KEY (testExecutionId) REFERENCES test_executions(id) ON DELETE CASCADE
    );
  `);

  // AI Interactions Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id TEXT PRIMARY KEY,
      interactionType TEXT NOT NULL, -- 'generate_packet', 'explain_attribute'
      userInput TEXT,                -- JSON string of the input given to the AI
      aiOutput TEXT,                 -- JSON string of the output received from the AI
      timestamp TEXT NOT NULL        -- ISO8601 string
    );
  `);
  console_log_info('Core tables schema checked/created.');

  // Dictionaries Table - Robust check and creation/alteration for exampleAttributes
  console_log_info("Starting schema check for 'dictionaries' table and 'exampleAttributes' column...");
  try {
    const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='dictionaries';");

    if (!tableExists) {
      console_log_info("'dictionaries' table does not exist. Creating it now with 'exampleAttributes' including DEFAULT '[]'.");
      await db.exec(`
        CREATE TABLE dictionaries (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source TEXT,
          isActive BOOLEAN DEFAULT TRUE,
          lastUpdated TEXT,
          exampleAttributes TEXT DEFAULT '[]' -- Added DEFAULT here
        );
      `);
      console_log_info("'dictionaries' table created successfully with 'exampleAttributes'.");
    } else {
      console_log_info("'dictionaries' table already exists. Checking for 'exampleAttributes' column...");
      const columns = await db.all("PRAGMA table_info(dictionaries);");
      const hasExampleAttributesColumn = columns.some(col => (col as any).name === 'exampleAttributes');

      if (!hasExampleAttributesColumn) {
        console_log_warn("Column 'exampleAttributes' NOT FOUND in 'dictionaries' table. Attempting to ADD it with DEFAULT '[]'...");
        // SQLite versions before 3.35.0 don't support ADD COLUMN with DEFAULT directly on existing tables without a more complex migration.
        // This simpler ADD COLUMN should work for newer SQLite versions.
        // For older ones, the subsequent UPDATE would handle it.
        await db.exec("ALTER TABLE dictionaries ADD COLUMN exampleAttributes TEXT DEFAULT '[]';");
        console_log_info("Column 'exampleAttributes' ADDED to 'dictionaries' table.");
      } else {
        console_log_info("Column 'exampleAttributes' already exists in 'dictionaries' table.");
      }
      // Ensure any NULLs are updated to '[]', this also handles cases where ALTER TABLE didn't set a default for existing rows.
      const updateResult = await db.run("UPDATE dictionaries SET exampleAttributes = '[]' WHERE exampleAttributes IS NULL;");
      if (updateResult.changes && updateResult.changes > 0) {
        console_log_info(`Updated ${updateResult.changes} rows in 'dictionaries' where 'exampleAttributes' was NULL to '[]'.`);
      } else {
        console_log_info("No rows in 'dictionaries' had NULL 'exampleAttributes' or needed update.");
      }
    }
  } catch (error: any) {
    console_log_error("Error during 'dictionaries' table schema check/migration for 'exampleAttributes':", error.message, error.stack);
  }
  console_log_info("Finished schema check for 'dictionaries.exampleAttributes'.");

  console_log_info('Database schema initialization complete (v3).');
}

// Optional: Call getDb once when the module loads to ensure the DB is initialized early in development.
if (process.env.NODE_ENV !== 'production') {
  getDb().catch(err => console_log_error("Failed to initialize DB on module load:", err));
}
