
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
    console.log_info('Attempting to open database at:', DB_PATH);
    const verboseSqlite3 = sqlite3.verbose();
    // Ensure the directory exists in production
    if (process.env.NODE_ENV === 'production') {
        const fs = await import('fs/promises');
        try {
            await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
            console.log_info('Ensured .data directory exists for production.');
        } catch (err) {
            console.error('Failed to create .data directory:', err);
        }
    }
    dbInstance = await open({
      filename: DB_PATH,
      driver: verboseSqlite3.Database,
    });
    console.log_info('Database opened successfully.');
    await initializeDatabaseSchema(dbInstance);
  }
  return dbInstance;
}

async function initializeDatabaseSchema(db: Database): Promise<void> {
  console.log_info('Initializing database schema...');

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
  console.log_info('Scenarios table schema checked/created.');

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
  console.log_info('Packets table schema checked/created.');

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
  console.log_info('Server Configurations table schema checked/created.');

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
  console.log_info('Database Configurations table schema checked/created.');

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
  console.log_info('Users table schema checked/created.');

  // Dictionaries Table
  console.log_info("Preparing to check/create 'dictionaries' table.");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dictionaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT,
      isActive BOOLEAN DEFAULT TRUE,
      lastUpdated TEXT,
      exampleAttributes TEXT DEFAULT '[]'
    );
  `);
  console.log_info("'dictionaries' table base schema checked/created with 'exampleAttributes' DEFAULT '[]'.");

  // Robustly check and add exampleAttributes column if missing from an older schema version
  try {
    console.log_info("Checking 'dictionaries' table structure for 'exampleAttributes' column...");
    const columns = await db.all("PRAGMA table_info(dictionaries);");
    const hasExampleAttributesColumn = columns.some(col => (col as any).name === 'exampleAttributes');

    if (!hasExampleAttributesColumn) {
      console.log_warn("Column 'exampleAttributes' not found in 'dictionaries' table. Attempting to ADD it with DEFAULT '[]'...");
      await db.exec("ALTER TABLE dictionaries ADD COLUMN exampleAttributes TEXT DEFAULT '[]';");
      console.log_info("Column 'exampleAttributes' ADDED to 'dictionaries' table with DEFAULT '[]'.");
      // After adding, ensure any existing rows (if any could exist before this alter) get the default.
      // This is more for safety as new rows would get the default.
      const updateExistingNulls = await db.run("UPDATE dictionaries SET exampleAttributes = '[]' WHERE exampleAttributes IS NULL;");
      if (updateExistingNulls.changes && updateExistingNulls.changes > 0) {
        console.log_info(`Updated ${updateExistingNulls.changes} existing rows to set exampleAttributes = '[]' after ALTER TABLE.`);
      }
    } else {
      console.log_info("Column 'exampleAttributes' already exists in 'dictionaries' table.");
      // If the column exists but somehow some rows have NULL (e.g., from a previous failed migration attempt), set them to '[]'
      const updateExistingNulls = await db.run("UPDATE dictionaries SET exampleAttributes = '[]' WHERE exampleAttributes IS NULL;");
      if (updateExistingNulls.changes && updateExistingNulls.changes > 0) {
        console.log_info(`Updated ${updateExistingNulls.changes} existing rows where exampleAttributes was NULL to '[]'.`);
      }
    }
  } catch (error) {
    console.error("Error during 'dictionaries' table schema check/migration for 'exampleAttributes':", error);
  }
  console.log_info("Finished schema check for 'dictionaries.exampleAttributes'.");


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
  console.log_info('Test Results table schema checked/created.');

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
  console.log_info('Test Executions table schema checked/created.');

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
  console.log_info('Execution Logs table schema checked/created.');

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
  console.log_info('AI Interactions table schema checked/created.');


  console.log_info('Database schema initialization complete.');
}

// Helper for logging with prefixes for clarity in server logs
function console_log_info(message: string, ...optionalParams: any[]) {
  console.info(`[DB_INIT INFO] ${message}`, ...optionalParams);
}
function console_log_warn(message: string, ...optionalParams: any[]) {
    console.warn(`[DB_INIT WARN] ${message}`, ...optionalParams);
}

// Optional: Call getDb once when the module loads to ensure the DB is initialized early in development.
// In a serverless environment, you might prefer to initialize on first request.
if (process.env.NODE_ENV !== 'production') {
  getDb().catch(err => console.error("Failed to initialize DB on module load:", err));
}
