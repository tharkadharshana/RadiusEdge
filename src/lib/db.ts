
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
    // Ensure the directory exists in production
    if (process.env.NODE_ENV === 'production') {
        const fs = await import('fs/promises');
        try {
            await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
        } catch (err) {
            console.error('Failed to create .data directory:', err);
            // Depending on policy, you might want to throw here or let open() fail
        }
    }
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

  // Dictionaries Table (for metadata and example attributes)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dictionaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT,
      isActive BOOLEAN DEFAULT TRUE,
      lastUpdated TEXT,       -- Store as ISO8601 string
      exampleAttributes TEXT  -- Store as JSON string of example Attribute objects, defaults to '[]'
    );
  `);
  console.log('Dictionaries table schema base checked/created.');

  // Attempt to add exampleAttributes column if it doesn't exist
  try {
    const columns = await db.all("PRAGMA table_info(dictionaries);");
    const hasExampleAttributesColumn = columns.some(col => (col as any).name === 'exampleAttributes');

    if (!hasExampleAttributesColumn) {
      console.log("Column 'exampleAttributes' not found in 'dictionaries' table. Attempting to add it...");
      await db.exec("ALTER TABLE dictionaries ADD COLUMN exampleAttributes TEXT;");
      // Initialize existing rows to '[]' if the column was just added.
      // This helps avoid issues with API trying to parse NULL.
      await db.exec("UPDATE dictionaries SET exampleAttributes = '[]' WHERE exampleAttributes IS NULL;");
      console.log("Column 'exampleAttributes' added to 'dictionaries' table and initialized for existing rows.");
    } else {
      // console.log("Column 'exampleAttributes' already exists in 'dictionaries' table.");
    }
  } catch (error) {
    console.error("Error checking/altering 'dictionaries' table for 'exampleAttributes' column:", error);
    // Depending on policy, you might want to throw here or let open() fail
  }


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
  console.log('Test Executions table checked/created.');

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
  console.log('Execution Logs table checked/created.');

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
  console.log('AI Interactions table checked/created.');


  console.log('Database schema initialization complete.');
}

// Optional: Call getDb once when the module loads to ensure the DB is initialized early in development.
// In a serverless environment, you might prefer to initialize on first request.
if (process.env.NODE_ENV !== 'production') {
  getDb().catch(err => console.error("Failed to initialize DB on module load:", err));
}
