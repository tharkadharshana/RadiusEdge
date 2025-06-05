import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { Connection as MssqlConnection, connect as mssqlConnect } from 'mssql';
import { Database as SqliteDatabase } from 'sqlite3';
import { promisify } from 'util';

export type DbType = 'mysql' | 'postgresql' | 'mssql' | 'sqlite';

interface DbConnectionConfig {
  type: DbType;
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
}

interface QueryResult {
  rows: any[];
  fields?: any[];
  error?: Error;
}

export class DbService {
  private mysqlConnection: mysql.Connection | null = null;
  private pgClient: PgClient | null = null;
  private mssqlConnection: MssqlConnection | null = null;
  private sqliteDb: SqliteDatabase | null = null;
  private currentConfig: DbConnectionConfig | null = null;

  async connect(config: DbConnectionConfig): Promise<void> {
    this.currentConfig = config;

    try {
      switch (config.type) {
        case 'mysql':
          this.mysqlConnection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database,
          });
          break;

        case 'postgresql':
          this.pgClient = new PgClient({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database,
          });
          await this.pgClient.connect();
          break;

        case 'mssql':
          this.mssqlConnection = await mssqlConnect({
            server: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database,
            options: {
              trustServerCertificate: true, // For development only
              encrypt: true,
            },
          });
          break;

        case 'sqlite':
          await new Promise<void>((resolve, reject) => {
            this.sqliteDb = new SqliteDatabase(config.database, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          break;

        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to ${config.type} database: ${errorMessage}`);
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.currentConfig) {
      throw new Error('Not connected to any database');
    }

    try {
      switch (this.currentConfig.type) {
        case 'mysql':
          if (!this.mysqlConnection) throw new Error('MySQL connection not established');
          const [rows, fields] = await this.mysqlConnection.execute(query);
          return { rows: rows as any[], fields };

        case 'postgresql':
          if (!this.pgClient) throw new Error('PostgreSQL connection not established');
          const pgResult = await this.pgClient.query(query);
          return { rows: pgResult.rows, fields: pgResult.fields };

        case 'mssql':
          if (!this.mssqlConnection) throw new Error('MSSQL connection not established');
          const mssqlResult = await this.mssqlConnection.query(query);
          return { rows: mssqlResult.recordset || [] };

        case 'sqlite':
          if (!this.sqliteDb) throw new Error('SQLite database not opened');
          return new Promise((resolve, reject) => {
            this.sqliteDb!.all(query, (error: Error | null, rows: any[]) => {
              if (error) reject(error);
              else resolve({ rows });
            });
          });

        default:
          throw new Error(`Unsupported database type: ${this.currentConfig.type}`);
      }
    } catch (error: unknown) {
      return { rows: [], error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.mysqlConnection) {
        await this.mysqlConnection.end();
        this.mysqlConnection = null;
      }
      if (this.pgClient) {
        await this.pgClient.end();
        this.pgClient = null;
      }
      if (this.mssqlConnection) {
        await this.mssqlConnection.close();
        this.mssqlConnection = null;
      }
      if (this.sqliteDb) {
        await promisify(this.sqliteDb.close.bind(this.sqliteDb))();
        this.sqliteDb = null;
      }
      this.currentConfig = null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error disconnecting from database: ${errorMessage}`);
    }
  }

  isConnected(): boolean {
    switch (this.currentConfig?.type) {
      case 'mysql':
        return this.mysqlConnection !== null;
      case 'postgresql':
        return this.pgClient !== null;
      case 'mssql':
        return this.mssqlConnection !== null;
      case 'sqlite':
        return this.sqliteDb !== null;
      default:
        return false;
    }
  }

  getCurrentConfig(): DbConnectionConfig | null {
    return this.currentConfig;
  }
}

// Create a singleton instance
export const dbService = new DbService(); 