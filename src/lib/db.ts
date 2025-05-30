
// src/lib/db.ts
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is imported if used here, though not in this file

// Define the path to the database file
const DB_PATH = process.env.NODE_ENV === 'production'
  ? path.join(process.cwd(), '.data/radiusedge.db') // In production, use a .data directory
  : path.join(process.cwd(), 'radiusedge.db');    // In development, use project root

let dbInstance: Database | null = null;

// Helper for logging with prefixes for clarity in server logs
function console_log_info(message: string, ...optionalParams: any[]) {
  console.log(`[DB_INIT INFO] ${new Date().toISOString()} ${message}`, ...optionalParams);
}
function console_log_warn(message: string, ...optionalParams: any[]) {
  console.warn(`[DB_INIT WARN] ${new Date().toISOString()} ${message}`, ...optionalParams);
}
function console_log_error(message: string, ...optionalParams: any[]) {
  console.error(`[DB_INIT ERROR] ${new Date().toISOString()} ${message}`, ...optionalParams);
}


export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    console_log_info('Attempting to open database at:', DB_PATH);
    const verboseSqlite3 = sqlite3.verbose();
    
    if (process.env.NODE_ENV === 'production') {
        const fs = await import('fs/promises');
        try {
            await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
            console_log_info('Ensured .data directory exists for production.');
        } catch (err: any) {
            console_log_error('Failed to create .data directory:', err.message);
            // Potentially re-throw or handle critical error
        }
    }

    try {
      dbInstance = await open({
        filename: DB_PATH,
        driver: verboseSqlite3.Database,
      });
      console_log_info('Database opened successfully.');
      await initializeDatabaseSchema(dbInstance);
    } catch (dbOpenError: any) {
      console_log_error('CRITICAL: Failed to open or initialize database:', dbOpenError.message, dbOpenError.stack);
      // If db cannot be opened/initialized, the app is likely unusable.
      // Propagate the error or handle it gracefully depending on requirements.
      throw dbOpenError; 
    }
  }
  return dbInstance;
}

async function initializeDatabaseSchema(db: Database): Promise<void> {
  console_log_info('BEGIN: Database schema initialization (v-latest with robust dictionary check)...');

  const tablesToCreate = [
    {
      name: 'scenarios',
      sql: `CREATE TABLE IF NOT EXISTS scenarios (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
              variables TEXT, steps TEXT, lastModified TEXT, tags TEXT
            );`
    },
    {
      name: 'packets',
      sql: `CREATE TABLE IF NOT EXISTS packets (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
              attributes TEXT, lastModified TEXT, tags TEXT,
              executionTool TEXT, toolOptions TEXT
            );`
    },
    {
      name: 'server_configs',
      sql: `CREATE TABLE IF NOT EXISTS server_configs (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, host TEXT,
              sshPort INTEGER, sshUser TEXT, authMethod TEXT, privateKey TEXT, password TEXT,
              radiusAuthPort INTEGER, radiusAcctPort INTEGER, defaultSecret TEXT,
              nasSpecificSecrets TEXT, status TEXT, testSteps TEXT, scenarioExecutionSshCommands TEXT
            );`
    },
    {
      name: 'db_configs',
      sql: `CREATE TABLE IF NOT EXISTS db_configs (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, host TEXT, port INTEGER,
              username TEXT, password TEXT, databaseName TEXT, status TEXT,
              sshPreambleSteps TEXT, validationSteps TEXT
            );`
    },
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, role TEXT,
              status TEXT, lastLogin TEXT, passwordHash TEXT
            );`
    },
    {
      name: 'test_results',
      sql: `CREATE TABLE IF NOT EXISTS test_results (
              id TEXT PRIMARY KEY, scenarioName TEXT NOT NULL, status TEXT NOT NULL,
              timestamp TEXT NOT NULL, latencyMs INTEGER, server TEXT, details TEXT
            );`
    },
    {
      name: 'test_executions',
      sql: `CREATE TABLE IF NOT EXISTS test_executions (
              id TEXT PRIMARY KEY, scenarioId TEXT, scenarioName TEXT NOT NULL,
              serverId TEXT, serverName TEXT NOT NULL, startTime TEXT NOT NULL,
              endTime TEXT, status TEXT NOT NULL, resultId TEXT,
              FOREIGN KEY (scenarioId) REFERENCES scenarios(id) ON DELETE SET NULL,
              FOREIGN KEY (serverId) REFERENCES server_configs(id) ON DELETE SET NULL,
              FOREIGN KEY (resultId) REFERENCES test_results(id) ON DELETE SET NULL
            );`
    },
    {
      name: 'execution_logs',
      sql: `CREATE TABLE IF NOT EXISTS execution_logs (
              id TEXT PRIMARY KEY, testExecutionId TEXT NOT NULL, timestamp TEXT NOT NULL,
              level TEXT NOT NULL, message TEXT NOT NULL, rawDetails TEXT,
              FOREIGN KEY (testExecutionId) REFERENCES test_executions(id) ON DELETE CASCADE
            );`
    },
    {
      name: 'ai_interactions',
      sql: `CREATE TABLE IF NOT EXISTS ai_interactions (
              id TEXT PRIMARY KEY, interactionType TEXT NOT NULL, userInput TEXT,
              aiOutput TEXT, timestamp TEXT NOT NULL
            );`
    }
  ];

  for (const table of tablesToCreate) {
    try {
      await db.exec(table.sql);
      console_log_info(`Table '${table.name}' checked/created successfully.`);
    } catch (err: any) {
      console_log_error(`Error ensuring table '${table.name}' exists:`, err.message, err.stack);
    }
  }

  // Dictionaries Table - Specific robust check and creation/alteration for exampleAttributes
  console_log_info("DICTIONARIES_TABLE_CHECK: Starting schema check for 'dictionaries' table and 'exampleAttributes' column...");
  try {
    const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='dictionaries';");

    if (!tableExists) {
      console_log_info("DICTIONARIES_TABLE_CHECK: 'dictionaries' table does not exist. Creating it now with 'exampleAttributes TEXT DEFAULT \'[]\''.");
      await db.exec(`
        CREATE TABLE dictionaries (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source TEXT,
          isActive BOOLEAN DEFAULT TRUE,
          lastUpdated TEXT,
          exampleAttributes TEXT DEFAULT '[]' -- Ensures new rows get the default
        );
      `);
      console_log_info("DICTIONARIES_TABLE_CHECK: 'dictionaries' table created successfully with 'exampleAttributes'.");
    } else {
      console_log_info("DICTIONARIES_TABLE_CHECK: 'dictionaries' table already exists. Checking for 'exampleAttributes' column...");
      const columnsPragma = await db.all("PRAGMA table_info(dictionaries);");
      const hasExampleAttributesColumn = columnsPragma.some(col => (col as any).name === 'exampleAttributes');

      if (!hasExampleAttributesColumn) {
        console_log_warn("DICTIONARIES_TABLE_CHECK: Column 'exampleAttributes' NOT FOUND in 'dictionaries' table. Attempting to ADD it with DEFAULT '[]'...");
        try {
          await db.exec("ALTER TABLE dictionaries ADD COLUMN exampleAttributes TEXT DEFAULT '[]';");
          console_log_info("DICTIONARIES_TABLE_CHECK: Column 'exampleAttributes' ADDED to 'dictionaries' table.");
          // After adding, explicitly update existing rows that would have NULL to '[]' if ALTER TABLE default didn't apply retrospectively (SQLite versions vary)
          const updateNullsResult = await db.run("UPDATE dictionaries SET exampleAttributes = '[]' WHERE exampleAttributes IS NULL;");
          console_log_info(`DICTIONARIES_TABLE_CHECK: Updated ${updateNullsResult.changes} existing rows to set exampleAttributes to '[]' after column addition.`);
        } catch (alterError: any) {
            console_log_error("DICTIONARIES_TABLE_CHECK: FAILED to ALTER 'dictionaries' table to add 'exampleAttributes':", alterError.message, alterError.stack);
        }
      } else {
        console_log_info("DICTIONARIES_TABLE_CHECK: Column 'exampleAttributes' already exists in 'dictionaries' table.");
        // Ensure any NULLs are updated to '[]', this also handles cases where ALTER TABLE didn't set a default for existing rows in older SQLite.
        const updateResult = await db.run("UPDATE dictionaries SET exampleAttributes = '[]' WHERE exampleAttributes IS NULL;");
        if (updateResult.changes && updateResult.changes > 0) {
          console_log_info(`DICTIONARIES_TABLE_CHECK: Updated ${updateResult.changes} rows in 'dictionaries' where 'exampleAttributes' was NULL to '[]'.`);
        } else {
          console_log_info("DICTIONARIES_TABLE_CHECK: No rows in 'dictionaries' had NULL 'exampleAttributes' or needed update for it.");
        }
      }
    }
  } catch (error: any) {
    console_log_error("DICTIONARIES_TABLE_CHECK: CRITICAL error during 'dictionaries' table schema check/migration for 'exampleAttributes':", error.message, error.stack);
  }
  console_log_info("DICTIONARIES_TABLE_CHECK: Finished schema check for 'dictionaries.exampleAttributes'.");

  console_log_info('END: Database schema initialization complete.');
}

// Optional: Call getDb once when the module loads to ensure the DB is initialized early in development.
if (process.env.NODE_ENV !== 'production') {
  getDb().catch(err => console_log_error("Failed to initialize DB on module load (this might be normal if server is pre-building):", err.message));
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE

    